package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/ports"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
	"github.com/HouseCham/gps-tracker/backend/utils"
)

const locationQueryTimeLayout = "2006-01-02T15:04:05"

const (
	defaultRouteMaxPoints = 1000
	maxRouteMaxPoints     = 1000

	// BA-11: caps for authenticated SSE streams. Process-wide and
	// in-memory — correct only under the audit's single-instance
	// constraint. ponytail: raise both once real capacity is measured.
	maxAuthStreams        = 500
	maxAuthStreamsPerUser = 5
)

// authStreamLimiter bounds authenticated SSE connections globally and
// per user. acquire reserves a slot, release returns it; the Stream
// handler wraps release in a sync.Once so each stream releases exactly
// the slot it acquired.
type authStreamLimiter struct {
	mu      sync.Mutex
	total   int
	perUser map[uuid.UUID]int
}

func newAuthStreamLimiter() *authStreamLimiter {
	return &authStreamLimiter{perUser: make(map[uuid.UUID]int)}
}

func (l *authStreamLimiter) acquire(userID uuid.UUID) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.total >= maxAuthStreams || l.perUser[userID] >= maxAuthStreamsPerUser {
		return false
	}
	l.total++
	l.perUser[userID]++
	return true
}

func (l *authStreamLimiter) release(userID uuid.UUID) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.total > 0 {
		l.total--
	}
	if c := l.perUser[userID]; c <= 1 {
		delete(l.perUser, userID)
	} else {
		l.perUser[userID] = c - 1
	}
}

// streamAccessChecker is the slice of *access.AccessService the stream
// needs: re-checking the viewer grant on every wake-up (BA-11).
type streamAccessChecker interface {
	RequireRole(ctx context.Context, userID, deviceID uuid.UUID, min domain.AccessRole) error
}

type LocationsHandler struct {
	service       *locations.Service
	subscriber    locations.LiveSubscriber
	access        streamAccessChecker
	sessionAuth   ports.SessionAuthenticator
	sessionCookie string
	streams       *authStreamLimiter
}

// NewLocationsHandler creates a new LocationsHandler. The access,
// sessionAuth and sessionCookie dependencies are only used by Stream
// (BA-11 revalidation); tests of other endpoints may pass nil for them.
func NewLocationsHandler(svc *locations.Service, subscriber locations.LiveSubscriber, access streamAccessChecker, sessionAuth ports.SessionAuthenticator, sessionCookie string) *LocationsHandler {
	return &LocationsHandler{
		service:       svc,
		subscriber:    subscriber,
		access:        access,
		sessionAuth:   sessionAuth,
		sessionCookie: sessionCookie,
		streams:       newAuthStreamLimiter(),
	}
}

// Ingest handles POST /api/v1/devices/:uuid_firmware/locations.
// Auth (device API key + uuid → device_id) is enforced by
// middleware.RequireDeviceAPIKey upstream; the handler does not
// re-check.
//
// The :uuid_firmware param is informational only — the middleware
// already resolved and stored the canonical device.id in c.Locals
// under LocalsKeyDeviceID. We never trust the path param itself
// because a device sending valid X-Device-API-Key with one
// :uuid_firmware and a stolen UUID for a different device is the
// threat model the middleware's device_id-equality check addresses.
//
// Idempotency: same body (same recorded_at) on the same device is
// a no-op at the DB layer (ON CONFLICT DO NOTHING). The handler
// therefore returns 201 on success regardless of whether the row
// is fresh or already-present — clients can retry safely.
func (h *LocationsHandler) Ingest(c fiber.Ctx) error {
	const operation = "LocationsHandler:Ingest"
	log.Debug(operation, "request received")

	deviceID, ok := middleware.GetRequestDeviceID(c)
	if !ok {
		log.Error(operation, "err", fiber.ErrUnauthorized, "reason", "missing device_id in locals")
		return middleware.UnauthorizedResponse(c)
	}

	req, ok := utils.GetValidatedBody[dto.IngestLocationRequest](c)
	if !ok {
		log.Error(operation, "err", fiber.ErrBadRequest, "reason", "invalid request body")
		return middleware.BadRequestResponse(c, "invalid request body")
	}

	log.Debug(operation, "executing use case", "deviceID", deviceID, "recorded_at", req.RecordedAt)
	loc, err := toDomainIngest(req, deviceID)
	if err != nil {
		log.Error(operation, "err", err, "deviceID", deviceID)
		return fmt.Errorf("LocationsHandler.Ingest: parse body: %w", err)
	}
	if err := h.service.Ingest(c.Context(), loc); err != nil {
		log.Error(operation, "err", err, "deviceID", deviceID)
		return fmt.Errorf("LocationsHandler.Ingest: %w", err)
	}

	log.Info(operation, "location ingested", "deviceID", deviceID)
	return c.SendStatus(fiber.StatusCreated)
}

func (h *LocationsHandler) IngestBatch(c fiber.Ctx) error {
	deviceID, ok := middleware.GetRequestDeviceID(c)
	if !ok {
		return middleware.UnauthorizedResponse(c)
	}
	req, ok := utils.GetValidatedBody[dto.IngestLocationBatchRequest](c)
	if !ok {
		return middleware.BadRequestResponse(c, "invalid request body")
	}
	items := make([]domain.Location, 0, len(req.Items))
	for _, item := range req.Items {
		loc, err := toDomainIngest(item, deviceID)
		if err != nil {
			return middleware.BadRequestResponse(c, "invalid request body")
		}
		items = append(items, loc)
	}
	accepted, rejected, err := h.service.IngestBatch(c.Context(), items)
	if err != nil {
		return fmt.Errorf("LocationsHandler.IngestBatch: %w", err)
	}
	responseRejected := make([]dto.BatchRejected, 0, len(rejected))
	for _, item := range rejected {
		responseRejected = append(responseRejected, dto.BatchRejected{SequenceID: item.SequenceID, Code: item.Code, Retryable: false})
	}
	return c.Status(fiber.StatusCreated).JSON(dto.IngestLocationBatchResponse{AcceptedSequenceIDs: accepted, Rejected: responseRejected})
}

// Latest handles GET /api/v1/devices/:id/locations/latest.
// Access (viewer or higher) is enforced by middleware.RequireDeviceRole;
// the device-existence check is therefore covered by that gate's
// 404 path (security-through-obscurity on user_device_access).
//
// Service.GetLatest returns domain.ErrNotFound when the device has never
// reported a location; we map that to a 404 envelope here rather than
// letting the httpErrorHandler turn it into a 500.
func (h *LocationsHandler) Latest(c fiber.Ctx) error {
	const operation = "LocationsHandler:Latest"
	log.Debug(operation, "request received")

	if _, ok := middleware.GetRequestUser(c); !ok {
		log.Error(operation, "err", fiber.ErrUnauthorized)
		return middleware.UnauthorizedResponse(c)
	}

	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		log.Error(operation, "err", err, "param", "id")
		return middleware.BadRequestResponse(c, "invalid device id")
	}

	log.Debug(operation, "executing use case", "deviceID", deviceID)
	loc, err := h.service.GetLatest(c.Context(), deviceID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			log.Info(operation, "no location reported yet", "deviceID", deviceID)
			return c.Status(fiber.StatusNotFound).JSON(response.HTTPResponse[struct{}]{
				StatusCode: fiber.StatusNotFound,
				Message:    "no location reported for this device yet",
			})
		}
		log.Error(operation, "err", err, "deviceID", deviceID)
		return fmt.Errorf("LocationsHandler.Latest: %w", err)
	}

	log.Info(operation, "latest location retrieved", "deviceID", deviceID, "recordedAt", loc.RecordedAt)
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[dto.LocationResponse]{
		StatusCode: fiber.StatusOK,
		Message:    "latest location retrieved",
		Data:       dto.LocationFromDomain(loc),
	})
}

// Live handles GET /api/v1/devices/:id/locations/live.
// It returns the latest location and presence state for the device.
// Access (viewer or higher) is enforced by middleware.RequireDeviceRole;
// the device-existence check is therefore covered by that gate's
// 404 path (security-through-obscurity on user_device_access).
func (h *LocationsHandler) Live(c fiber.Ctx) error {
	if _, ok := middleware.GetRequestUser(c); !ok {
		return middleware.UnauthorizedResponse(c)
	}
	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		return middleware.BadRequestResponse(c, "invalid device id")
	}
	value, err := h.service.GetLive(c.Context(), deviceID, time.Now().UTC())
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(response.HTTPResponse[struct{}]{StatusCode: fiber.StatusNotFound, Message: "device not found"})
		}
		return fmt.Errorf("LocationsHandler.Live: %w", err)
	}
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[dto.LiveLocationResponse]{StatusCode: fiber.StatusOK, Message: "live location retrieved", Data: dto.LiveLocationFromDomain(value)})
}

// Stream handles GET /api/v1/devices/:id/locations/stream.
// It returns a stream of live events for the device, including location updates and presence changes.
// Access (viewer or higher) is enforced by middleware.RequireDeviceRole;
// the device-existence check is therefore covered by that gate's
// 404 path (security-through-obscurity on user_device_access).
//
// BA-11: the connection holds one global+per-user stream slot (429 when
// over a cap) and the session and device grant are re-checked on every
// loop wake-up, so a revoked session or grant stops the stream within
// one wake-up — at most the 25s keepalive interval.
func (h *LocationsHandler) Stream(c fiber.Ctx) error {
	user, ok := middleware.GetRequestUser(c)
	if !ok {
		return middleware.UnauthorizedResponse(c)
	}
	if h.subscriber == nil {
		return fmt.Errorf("LocationsHandler.Stream: live subscriber unavailable")
	}
	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		return middleware.BadRequestResponse(c, "invalid device id")
	}
	// Over the cap is a controlled 429, not a hang or a leak: no
	// subscription has been created at this point.
	if !h.streams.acquire(user.ID) {
		return c.Status(fiber.StatusTooManyRequests).JSON(response.HTTPResponse[bool]{
			StatusCode: fiber.StatusTooManyRequests,
			Message:    "too many live streams",
		})
	}
	slotTransferred := false
	defer func() {
		if !slotTransferred {
			h.streams.release(user.ID)
		}
	}()

	events, unsubscribe := h.subscriber.Subscribe(deviceID)
	// Ownership of the subscription and the stream slot transfers to
	// the stream writer below: the handler returns as soon as the
	// writer is registered, so a defer here would close the events
	// channel before the writer ever drains it (BA-03). Until the
	// transfer point (any error on the way to SendStreamWriter) the
	// defers stay armed.
	subscriptionTransferred := false
	defer func() {
		if !subscriptionTransferred {
			unsubscribe()
		}
	}()
	var cleanupOnce sync.Once
	cleanup := func() {
		cleanupOnce.Do(func() {
			unsubscribe()
			h.streams.release(user.ID)
		})
	}

	sessionToken := c.Cookies(h.sessionCookie)
	initial, err := h.service.GetLive(c.Context(), deviceID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("LocationsHandler.Stream: get live snapshot: %w", err)
	}
	c.Set("Content-Type", "text/event-stream; charset=utf-8")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	slotTransferred = true
	subscriptionTransferred = true
	err = c.SendStreamWriter(func(writer *bufio.Writer) {
		defer cleanup()
		const operation = "LocationsHandler:Stream"
		if err := writeSSE(writer, locations.LiveEvent{ID: h.subscriber.NextID(), Kind: "snapshot", Snapshot: initial}); err != nil {
			log.Error(operation, "err", err, "deviceID", deviceID, "stage", "snapshot")
			return
		}
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		timer := presenceTimer(initial.Presence.ExpiresAt)
		defer timer.Stop()
		for {
			select {
			case <-c.Context().Done():
				return
			case event, ok := <-events:
				if !ok || !h.stillAuthorized(c, sessionToken, user.ID, deviceID) {
					return
				}
				if err := writeSSE(writer, event); err != nil {
					log.Error(operation, "err", err, "deviceID", deviceID, "stage", "event")
					return
				}
				resetTimer(timer, event.Snapshot.Presence.ExpiresAt)
			case <-ticker.C:
				// The keepalive doubles as the revalidation beat: a
				// revoked session or grant ends the stream here even
				// when no location events are flowing.
				if !h.stillAuthorized(c, sessionToken, user.ID, deviceID) {
					return
				}
				if _, err := writer.WriteString(": keepalive\n\n"); err != nil {
					log.Error(operation, "err", err, "deviceID", deviceID, "stage", "keepalive")
					return
				}
				if err := writer.Flush(); err != nil {
					log.Error(operation, "err", err, "deviceID", deviceID, "stage", "keepalive")
					return
				}
			case <-timer.C:
				if !h.stillAuthorized(c, sessionToken, user.ID, deviceID) {
					return
				}
				snapshot, err := h.service.GetLive(c.Context(), deviceID, time.Now().UTC())
				if err != nil {
					log.Error(operation, "err", err, "deviceID", deviceID, "stage", "presence refresh")
					return
				}
				if err := writeSSE(writer, locations.LiveEvent{ID: h.subscriber.NextID(), Kind: "presence", Snapshot: snapshot}); err != nil {
					log.Error(operation, "err", err, "deviceID", deviceID, "stage", "presence")
					return
				}
				resetTimer(timer, snapshot.Presence.ExpiresAt)
			}
		}
	})
	if err != nil {
		cleanup()
	}
	return err
}

// stillAuthorized re-checks at every loop wake-up that the session
// still authenticates and the device grant still allows viewer. Any
// failure ends the stream; the client's reconnect then gets a proper
// 401/403 from the route middleware if it may not come back.
func (h *LocationsHandler) stillAuthorized(c fiber.Ctx, sessionToken string, userID, deviceID uuid.UUID) bool {
	if h.sessionAuth == nil || h.access == nil || sessionToken == "" {
		return false
	}
	actor, err := h.sessionAuth.Authenticate(c.Context(), sessionToken)
	if err != nil || actor == nil || actor.ID == "" {
		return false
	}
	return h.access.RequireRole(c.Context(), userID, deviceID, domain.AccessRoleViewer) == nil
}

// writeSSE writes a single Server-Sent Event to the writer, wrapping any
// marshalling or IO error with the stage where it occurred.
func writeSSE(writer *bufio.Writer, event locations.LiveEvent) error {
	payload, err := json.Marshal(dto.LiveLocationFromDomain(event.Snapshot))
	if err != nil {
		return fmt.Errorf("writeSSE: marshal: %w", err)
	}
	if _, err = fmt.Fprintf(writer, "event: %s\nid: %d\ndata: %s\n\n", event.Kind, event.ID, payload); err != nil {
		return fmt.Errorf("writeSSE: write: %w", err)
	}
	if err := writer.Flush(); err != nil {
		return fmt.Errorf("writeSSE: flush: %w", err)
	}
	return nil
}

// presenceTimer returns a timer that will fire when the device's presence state is expected to change.
func presenceTimer(expiresAt *time.Time) *time.Timer {
	if expiresAt == nil {
		return time.NewTimer(time.Hour)
	}
	delay := time.Until(*expiresAt)
	if delay <= 0 {
		// An expired deadline means presence is already offline; avoid a zero-delay refresh loop.
		delay = time.Hour
	}
	return time.NewTimer(delay)
}

// resetTimer resets the timer to fire when the device's presence state is expected to change.
func resetTimer(timer *time.Timer, expiresAt *time.Time) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	delay := time.Hour
	if expiresAt != nil {
		delay = time.Until(*expiresAt)
		if delay <= 0 {
			// ponytail: offline streams recheck hourly; live events still deliver a sooner state change.
			delay = time.Hour
		}
	}
	timer.Reset(delay)
}

// History handles GET /api/v1/devices/:id/locations.
// from and to are local wall-clock values interpreted in the supplied IANA
// time zone, then converted to UTC before the database query.
func (h *LocationsHandler) History(c fiber.Ctx) error {
	const operation = "LocationsHandler:History"
	log.Debug(operation, "request received")

	if _, ok := middleware.GetRequestUser(c); !ok {
		log.Error(operation, "err", fiber.ErrUnauthorized)
		return middleware.UnauthorizedResponse(c)
	}

	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		log.Error(operation, "err", err, "param", "id")
		return middleware.BadRequestResponse(c, "invalid device id")
	}

	from, to, err := parseLocationRange(c)
	if err != nil {
		log.Error(operation, "err", err, "deviceID", deviceID)
		return middleware.BadRequestResponse(c, err.Error())
	}

	page, pageSize := parsePagination(c, defaultPageSize)
	log.Debug(operation, "executing use case", "deviceID", deviceID, "from", from, "to", to, "page", page, "pageSize", pageSize)
	items, total, err := h.service.GetHistory(c.Context(), deviceID, from, to, page, pageSize)
	if err != nil {
		log.Error(operation, "err", err, "deviceID", deviceID)
		return fmt.Errorf("LocationsHandler.History: %w", err)
	}

	locations := make([]dto.LocationResponse, 0, len(items))
	for i := range items {
		locations = append(locations, dto.LocationFromDomain(items[i]))
	}

	totalPages := total / pageSize
	if total%pageSize > 0 {
		totalPages++
	}

	log.Info(operation, "location history retrieved", "deviceID", deviceID, "count", len(locations), "total", total)
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[dto.LocationListResponse]{
		StatusCode: fiber.StatusOK,
		Message:    "location history retrieved",
		Data: dto.LocationListResponse{
			Items: locations,
			Pagination: dto.PaginationMeta{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: totalPages,
			},
		},
	})
}

// Route handles GET /api/v1/devices/:id/locations/route.
// It returns a chronological, bounded route for map rendering.
func (h *LocationsHandler) Route(c fiber.Ctx) error {
	const operation = "LocationsHandler:Route"
	log.Debug(operation, "request received")

	if _, ok := middleware.GetRequestUser(c); !ok {
		log.Error(operation, "err", fiber.ErrUnauthorized)
		return middleware.UnauthorizedResponse(c)
	}

	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		log.Error(operation, "err", err, "param", "id")
		return middleware.BadRequestResponse(c, "invalid device id")
	}

	from, to, err := parseLocationRange(c)
	if err != nil {
		log.Error(operation, "err", err, "deviceID", deviceID)
		return middleware.BadRequestResponse(c, err.Error())
	}

	maxPoints := parseRouteMaxPoints(c)
	items, total, sampled, err := h.service.GetRoute(c.Context(), deviceID, from, to, maxPoints)
	if err != nil {
		log.Error(operation, "err", err, "deviceID", deviceID)
		return fmt.Errorf("LocationsHandler.Route: %w", err)
	}

	locations := make([]dto.LocationResponse, 0, len(items))
	for i := range items {
		locations = append(locations, dto.LocationFromDomain(items[i]))
	}

	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[dto.LocationRouteResponse]{
		StatusCode: fiber.StatusOK,
		Message:    "location route retrieved",
		Data: dto.LocationRouteResponse{
			Items:       locations,
			TotalPoints: total,
			Returned:    len(locations),
			Sampled:     sampled,
		},
	})
}

// parseRouteMaxPoints parses the max_points query parameter, returning a default if not provided or invalid.
func parseRouteMaxPoints(c fiber.Ctx) int {
	raw := c.Query("max_points")
	if raw == "" {
		return defaultRouteMaxPoints
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 2 || value > maxRouteMaxPoints {
		return defaultRouteMaxPoints
	}
	return value
}

// parseLocationRange parses the from and to query parameters, returning a default if not provided or invalid.
func parseLocationRange(c fiber.Ctx) (time.Time, time.Time, error) {
	fromValue := c.Query("from")
	toValue := c.Query("to")
	timeZone := c.Query("time-zone")
	if fromValue == "" || toValue == "" || timeZone == "" {
		return time.Time{}, time.Time{}, errors.New("from, to, and time-zone are required")
	}

	location, err := time.LoadLocation(timeZone)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid time-zone")
	}

	from, err := time.ParseInLocation(locationQueryTimeLayout, fromValue, location)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid from")
	}
	to, err := time.ParseInLocation(locationQueryTimeLayout, toValue, location)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid to")
	}
	if !from.Before(to) {
		return time.Time{}, time.Time{}, errors.New("from must be before to")
	}

	return from.UTC(), to.UTC(), nil
}

// toDomainIngest projects the validated DTO into a domain.Location.
// Time parsing is the only nontrivial bit — the DTO's rfc3339 validator
// already confirmed the format, so a failure here is a logic bug.
func toDomainIngest(req dto.IngestLocationRequest, deviceID uuid.UUID) (domain.Location, error) {
	recordedAt, err := time.Parse(time.RFC3339, req.RecordedAt)
	if err != nil {
		return domain.Location{}, err
	}
	return domain.Location{
		DeviceID:       deviceID,
		SequenceID:     req.SequenceID,
		RecordedAt:     recordedAt,
		Latitude:       *req.Latitude,
		Longitude:      *req.Longitude,
		Altitude:       req.Altitude,
		Speed:          req.Speed,
		Accuracy:       req.Accuracy,
		BatteryVoltage: req.BatteryVoltage,
		SignalStrength: req.SignalStrength,
	}, nil
}
