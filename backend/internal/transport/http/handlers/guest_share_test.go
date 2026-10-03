package handlers_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/app/sharelinks"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/handlers"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
)

type shareLinkMemory struct {
	link       sharelinks.Link
	hash       string
	valid      bool
	resolveErr error
}

func (r *shareLinkMemory) Create(_ context.Context, deviceID, ownerID uuid.UUID, tokenHash string, expiresAt time.Time) (sharelinks.Link, error) {
	r.hash = tokenHash
	r.valid = true
	r.link = sharelinks.Link{
		ID:         uuid.New(),
		DeviceID:   deviceID,
		CreatedBy:  ownerID,
		CreatedAt:  time.Now().UTC(),
		ExpiresAt:  expiresAt,
		DeviceName: "Test vehicle",
	}
	return r.link, nil
}

func (r *shareLinkMemory) ListActive(context.Context, uuid.UUID) ([]sharelinks.Link, error) {
	return nil, nil
}

func (r *shareLinkMemory) Revoke(context.Context, uuid.UUID, uuid.UUID) error {
	r.valid = false
	return nil
}

func (r *shareLinkMemory) GetActiveByTokenHash(_ context.Context, tokenHash string) (sharelinks.Link, error) {
	if r.resolveErr != nil {
		return sharelinks.Link{}, r.resolveErr
	}
	if !r.valid || tokenHash != r.hash || !r.link.ExpiresAt.After(time.Now()) {
		return sharelinks.Link{}, domain.ErrNotFound
	}
	return r.link, nil
}

type locationMemory struct {
	value domain.LiveLocation
}

func (locationMemory) Insert(context.Context, domain.Location) error { return nil }
func (locationMemory) GetLatest(context.Context, uuid.UUID) (domain.Location, error) {
	return domain.Location{}, domain.ErrNotFound
}
func (locationMemory) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return nil, 0, nil
}
func (locationMemory) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return nil, 0, false, nil
}
func (r locationMemory) GetLive(context.Context, uuid.UUID, time.Time, time.Duration, float64) (domain.LiveLocation, error) {
	return r.value, nil
}

func newGuestHandler(repo *shareLinkMemory) (*handlers.GuestShareHandler, string) {
	shares := sharelinks.New(repo)
	created, err := shares.Create(context.Background(), uuid.New(), uuid.New(), 1)
	if err != nil {
		panic(err)
	}
	altitude, speed, accuracy, battery := 12.0, 5.0, 2.0, 3.8
	signal := 20
	location := domain.Location{
		DeviceID:       created.Link.DeviceID,
		RecordedAt:     time.Now().UTC(),
		Latitude:       19.4,
		Longitude:      -99.1,
		Altitude:       &altitude,
		Speed:          &speed,
		Accuracy:       &accuracy,
		BatteryVoltage: &battery,
		SignalStrength: &signal,
	}
	live := domain.LiveLocation{
		DeviceID:   created.Link.DeviceID,
		Location:   &location,
		Presence:   domain.DevicePresence{State: domain.PresenceOnlineMoving},
		ServerTime: time.Now().UTC(),
	}
	return handlers.NewGuestShareHandler(shares, locations.New(locationMemory{}, locationMemory{value: live}), nil, false), created.Token
}

func TestGuestShareConsumeSetsHttpOnlyCapabilityCookieWithoutAccountSession(t *testing.T) {
	handler, token := newGuestHandler(&shareLinkMemory{})
	app := fiber.New()
	app.Post("/consume", middleware.ValidateRequestBody[dto.ConsumeShareLinkRequest](), handler.Consume)
	req := httptest.NewRequest(http.MethodPost, "/consume", strings.NewReader(`{"token":"`+token+`"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}
	cookies := resp.Cookies()
	if len(cookies) != 1 || cookies[0].Name != "open_gps_guest_share" || !cookies[0].HttpOnly {
		t.Fatalf("guest capability cookie = %#v", cookies)
	}
	if cookies[0].Value != token || cookies[0].Path != "/api/v1/guest" {
		t.Fatalf("unexpected guest cookie attributes: %#v", cookies[0])
	}
}

func TestGuestLiveReturnsCurrentCoordinatesWithoutTelemetryOrDeviceID(t *testing.T) {
	repo := &shareLinkMemory{}
	handler, token := newGuestHandler(repo)
	app := fiber.New()
	app.Get("/live", handler.Live)
	req := httptest.NewRequest(http.MethodGet, "/live", nil)
	req.AddCookie(&http.Cookie{Name: "open_gps_guest_share", Value: token})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}
	var envelope struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		t.Fatal(err)
	}
	if _, exists := envelope.Data["device_id"]; exists {
		t.Fatal("guest response exposed device id")
	}
	var location map[string]json.RawMessage
	if err := json.Unmarshal(envelope.Data["location"], &location); err != nil {
		t.Fatal(err)
	}
	for _, field := range []string{"recorded_at", "latitude", "longitude"} {
		if _, exists := location[field]; !exists {
			t.Errorf("guest location omitted %q", field)
		}
	}
	for _, field := range []string{"altitude", "speed", "accuracy", "battery_voltage", "signal_strength"} {
		if _, exists := location[field]; exists {
			t.Errorf("guest location exposed telemetry field %q", field)
		}
	}
}

func TestGuestLiveRejectsRevokedLink(t *testing.T) {
	repo := &shareLinkMemory{}
	handler, token := newGuestHandler(repo)
	repo.valid = false
	app := fiber.New()
	app.Get("/live", handler.Live)
	req := httptest.NewRequest(http.MethodGet, "/live", nil)
	req.AddCookie(&http.Cookie{Name: "open_gps_guest_share", Value: token})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d, want 401", resp.StatusCode)
	}
}

func TestGuestLiveDoesNotClearCookieOnResolveError(t *testing.T) {
	repo := &shareLinkMemory{}
	handler, token := newGuestHandler(repo)
	repo.resolveErr = errors.New("temporary database outage")
	app := fiber.New()
	app.Get("/live", handler.Live)
	req := httptest.NewRequest(http.MethodGet, "/live", nil)
	req.AddCookie(&http.Cookie{Name: "open_gps_guest_share", Value: token})
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status=%d, want 500", resp.StatusCode)
	}
	for _, cookie := range resp.Cookies() {
		if cookie.Name == "open_gps_guest_share" && cookie.MaxAge < 0 {
			t.Fatal("transient resolution error cleared the guest cookie")
		}
	}
}
