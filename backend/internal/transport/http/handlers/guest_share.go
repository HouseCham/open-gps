package handlers

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/app/sharelinks"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
	"github.com/HouseCham/gps-tracker/backend/utils"
)

const guestShareCookieName = "open_gps_guest_share"
const maxGuestStreams = 100

// ponytail: a process-wide cap bounds SSE goroutines and periodic DB checks; raise it when capacity is measured.
var guestStreams = make(chan struct{}, maxGuestStreams)

type GuestShareHandler struct {
	shares     *sharelinks.Service
	locations  *locations.Service
	subscriber locations.LiveSubscriber
	secure     bool
}

func NewGuestShareHandler(shares *sharelinks.Service, locationsService *locations.Service, subscriber locations.LiveSubscriber, secure bool) *GuestShareHandler {
	return &GuestShareHandler{shares: shares, locations: locationsService, subscriber: subscriber, secure: secure}
}

func (h *GuestShareHandler) Consume(c fiber.Ctx) error {
	req, ok := utils.GetValidatedBody[dto.ConsumeShareLinkRequest](c)
	if !ok {
		return middleware.BadRequestResponse(c, "invalid request body")
	}
	link, err := h.shares.ResolveToken(c.Context(), req.Token)
	if err != nil {
		if errors.Is(err, sharelinks.ErrInvalidLink) {
			h.clearCookie(c)
			return middleware.UnauthorizedResponse(c)
		}
		return fmt.Errorf("GuestShareHandler.Consume: %w", err)
	}
	maxAge := int(time.Until(link.ExpiresAt).Seconds())
	if maxAge < 1 {
		maxAge = 1
	}
	c.Cookie(&fiber.Cookie{
		Name:     guestShareCookieName,
		Value:    req.Token,
		Path:     "/api/v1/guest",
		Expires:  link.ExpiresAt,
		MaxAge:   maxAge,
		HTTPOnly: true,
		Secure:   h.secure,
		SameSite: "Strict",
	})
	c.Set("Cache-Control", "no-store")
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[dto.GuestShareSessionResponse]{
		StatusCode: fiber.StatusOK,
		Message:    "guest access granted",
		Data: dto.GuestShareSessionResponse{
			DeviceName: link.DeviceName,
			ExpiresAt:  link.ExpiresAt,
		},
	})
}

func (h *GuestShareHandler) Live(c fiber.Ctx) error {
	link, token, ok, err := h.resolveCookie(c)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	value, err := h.locations.GetLive(c.Context(), link.DeviceID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("GuestShareHandler.Live: %w", err)
	}
	if _, err := h.shares.ResolveToken(c.Context(), token); err != nil {
		if errors.Is(err, sharelinks.ErrInvalidLink) {
			h.clearCookie(c)
			return middleware.UnauthorizedResponse(c)
		}
		return fmt.Errorf("GuestShareHandler.Live: revalidate share link: %w", err)
	}
	c.Set("Cache-Control", "no-store")
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[dto.GuestLiveResponse]{
		StatusCode: fiber.StatusOK,
		Message:    "guest location retrieved",
		Data:       dto.GuestLiveFromDomain(link.DeviceName, value),
	})
}

func (h *GuestShareHandler) Stream(c fiber.Ctx) error {
	var releaseSlotOnce sync.Once
	releaseSlot := func() { releaseSlotOnce.Do(func() { <-guestStreams }) }
	select {
	case guestStreams <- struct{}{}:
	default:
		return c.Status(fiber.StatusTooManyRequests).JSON(response.HTTPResponse[bool]{
			StatusCode: fiber.StatusTooManyRequests,
			Message:    "too many guest streams",
		})
	}
	slotTransferred := false
	defer func() {
		if !slotTransferred {
			releaseSlot()
		}
	}()
	link, token, ok, err := h.resolveCookie(c)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	if h.subscriber == nil {
		return fmt.Errorf("GuestShareHandler.Stream: live subscriber unavailable")
	}
	if _, err := h.shares.ResolveToken(c.Context(), token); err != nil {
		if errors.Is(err, sharelinks.ErrInvalidLink) {
			h.clearCookie(c)
			return middleware.UnauthorizedResponse(c)
		}
		return fmt.Errorf("GuestShareHandler.Stream: revalidate share link: %w", err)
	}
	events, unsubscribe := h.subscriber.Subscribe(link.DeviceID)
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
			releaseSlot()
		})
	}
	initial, err := h.locations.GetLive(c.Context(), link.DeviceID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("GuestShareHandler.Stream: get live snapshot: %w", err)
	}
	c.Set("Content-Type", "text/event-stream; charset=utf-8")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")
	slotTransferred = true
	subscriptionTransferred = true
	err = c.SendStreamWriter(func(writer *bufio.Writer) {
		defer cleanup()
		if err := writeGuestSSE(writer, h.subscriber.NextID(), "snapshot", link.DeviceName, initial); err != nil {
			log.Error("GuestShareHandler.Stream", "err", err, "stage", "snapshot")
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
				if !ok || !h.shareStillActive(c, token, link.ID) {
					return
				}
				if err := writeGuestSSE(writer, event.ID, event.Kind, link.DeviceName, event.Snapshot); err != nil {
					log.Error("GuestShareHandler.Stream", "err", err, "stage", "event")
					return
				}
				resetTimer(timer, event.Snapshot.Presence.ExpiresAt)
			case <-ticker.C:
				if !h.shareStillActive(c, token, link.ID) {
					return
				}
				if _, err := writer.WriteString(": keepalive\n\n"); err != nil {
					return
				}
				if err := writer.Flush(); err != nil {
					return
				}
			case <-timer.C:
				if !h.shareStillActive(c, token, link.ID) {
					return
				}
				snapshot, err := h.locations.GetLive(c.Context(), link.DeviceID, time.Now().UTC())
				if err != nil {
					log.Error("GuestShareHandler.Stream", "err", err, "stage", "presence refresh")
					return
				}
				if err := writeGuestSSE(writer, h.subscriber.NextID(), "presence", link.DeviceName, snapshot); err != nil {
					log.Error("GuestShareHandler.Stream", "err", err, "stage", "presence")
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

func (h *GuestShareHandler) resolveCookie(c fiber.Ctx) (sharelinks.Link, string, bool, error) {
	token := c.Cookies(guestShareCookieName)
	link, err := h.shares.ResolveToken(c.Context(), token)
	if err != nil {
		if errors.Is(err, sharelinks.ErrInvalidLink) {
			h.clearCookie(c)
			if responseErr := middleware.UnauthorizedResponse(c); responseErr != nil {
				return sharelinks.Link{}, "", false, responseErr
			}
			return sharelinks.Link{}, "", false, nil
		}
		return sharelinks.Link{}, "", false, fmt.Errorf("GuestShareHandler.resolveCookie: %w", err)
	}
	return link, token, true, nil
}

func (h *GuestShareHandler) shareStillActive(c fiber.Ctx, token string, linkID uuid.UUID) bool {
	link, err := h.shares.ResolveToken(c.Context(), token)
	if err != nil {
		if errors.Is(err, sharelinks.ErrInvalidLink) {
			h.clearCookie(c)
		}
		return false
	}
	if link.ID != linkID {
		h.clearCookie(c)
		return false
	}
	return true
}

func (h *GuestShareHandler) clearCookie(c fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     guestShareCookieName,
		Value:    "",
		Path:     "/api/v1/guest",
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   h.secure,
		SameSite: "Strict",
	})
}

func writeGuestSSE(writer *bufio.Writer, id uint64, kind, deviceName string, snapshot domain.LiveLocation) error {
	payload, err := json.Marshal(dto.GuestLiveFromDomain(deviceName, snapshot))
	if err != nil {
		return fmt.Errorf("writeGuestSSE: marshal: %w", err)
	}
	if _, err = fmt.Fprintf(writer, "event: %s\nid: %d\ndata: %s\n\n", kind, id, payload); err != nil {
		return fmt.Errorf("writeGuestSSE: write: %w", err)
	}
	return writer.Flush()
}
