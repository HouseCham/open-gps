package handlers_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/handlers"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
)

type historyReader struct {
	items  []domain.Location
	total  int
	from   time.Time
	to     time.Time
	limit  int
	offset int
}

func (r *historyReader) GetLatest(context.Context, uuid.UUID) (domain.Location, error) {
	return domain.Location{}, nil
}

func (r *historyReader) GetHistory(_ context.Context, _ uuid.UUID, from, to time.Time, limit, offset int) ([]domain.Location, int, error) {
	r.from = from
	r.to = to
	r.limit = limit
	r.offset = offset
	return r.items, r.total, nil
}

type historyWriter struct{}

func (historyWriter) Insert(context.Context, domain.Location) error { return nil }

func newHistoryApp(t *testing.T, svc *locations.Service) *fiber.App {
	t.Helper()
	app := fiber.New()
	dummyUser := &domain.User{ID: uuid.New(), Email: "test@example.com"}
	app.Get(
		"/api/v1/devices/:id/locations",
		func(c fiber.Ctx) error {
			c.Locals(middleware.LocalsKeyUser, dummyUser)
			return c.Next()
		},
		handlers.NewLocationsHandler(svc).History,
	)
	return app
}

func TestLocationsHandler_HistoryConvertsTimezoneAndPaginates(t *testing.T) {
	deviceID := uuid.New()
	want := domain.Location{DeviceID: deviceID, RecordedAt: time.Date(2026, time.August, 17, 19, 0, 0, 0, time.UTC)}
	r := &historyReader{items: []domain.Location{want}, total: 21}
	app := newHistoryApp(t, locations.New(historyWriter{}, r))

	path := "/api/v1/devices/" + deviceID.String() + "/locations?from=2026-08-17T12:00:00&to=2026-08-17T14:00:00&time-zone=America/Mexico_City&page=2&page_size=10"
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}

	if got, want := r.from, time.Date(2026, time.August, 17, 18, 0, 0, 0, time.UTC); !got.Equal(want) {
		t.Errorf("from=%v want %v", got, want)
	}
	if got, want := r.to, time.Date(2026, time.August, 17, 20, 0, 0, 0, time.UTC); !got.Equal(want) {
		t.Errorf("to=%v want %v", got, want)
	}
	if r.limit != 10 || r.offset != 10 {
		t.Errorf("pagination=(%d, %d) want (10, 10)", r.limit, r.offset)
	}

	var env struct {
		Data dto.LocationListResponse `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(env.Data.Items) != 1 || env.Data.Pagination.Total != 21 || env.Data.Pagination.TotalPages != 3 {
		t.Errorf("data=%+v want one item, total 21, total_pages 3", env.Data)
	}
}

func TestLocationsHandler_HistoryRejectsInvalidRange(t *testing.T) {
	r := &historyReader{}
	app := newHistoryApp(t, locations.New(historyWriter{}, r))
	base := "/api/v1/devices/" + uuid.New().String() + "/locations"
	cases := []string{
		base,
		base + "?from=2026-08-17T12:00:00&to=2026-08-17T14:00:00&time-zone=Not/AZone",
		base + "?from=2026-08-17T14:00:00&to=2026-08-17T12:00:00&time-zone=America/Mexico_City",
	}
	for _, path := range cases {
		resp, err := app.Test(httptest.NewRequest(http.MethodGet, path, nil))
		if err != nil {
			t.Fatalf("app.Test: %v", err)
		}
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("path=%q status=%d want 400", path, resp.StatusCode)
		}
	}
	if !r.from.IsZero() || !r.to.IsZero() {
		t.Error("reader called for invalid range")
	}
}
