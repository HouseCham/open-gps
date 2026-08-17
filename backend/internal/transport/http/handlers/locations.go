package handlers

import (
	"errors"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
	"github.com/HouseCham/gps-tracker/backend/utils"
)

const locationQueryTimeLayout = "2006-01-02T15:04:05"

type LocationsHandler struct {
	service *locations.Service
}

func NewLocationsHandler(svc *locations.Service) *LocationsHandler {
	return &LocationsHandler{service: svc}
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
			return c.Status(fiber.StatusNotFound).JSON(response.HTTPResponse[any]{
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
		RecordedAt:     recordedAt,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		Altitude:       req.Altitude,
		Speed:          req.Speed,
		Accuracy:       req.Accuracy,
		BatteryVoltage: req.BatteryVoltage,
		SignalStrength: req.SignalStrength,
	}, nil
}
