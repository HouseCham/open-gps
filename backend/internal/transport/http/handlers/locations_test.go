package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

// recordingWriter is the Writer port mock used by every Ingest test.
// Kept here (rather than in the Ingest-only newApp helper) because the
// Latest tests instantiate locations.New with a writer argument too,
// and a fresh zero-valued struct satisfies the Writer interface.
type recordingWriter struct {
	calls int
	err   error
}

func (r *recordingWriter) Insert(_ context.Context, _ domain.Location) error {
	r.calls++
	return r.err
}

// newApp wires just the Ingest endpoint onto a fresh Fiber. The
// production router adds auth + uuid resolution on top, but those
// touch Postgres / Authula and live in their own layers.
func newApp(t *testing.T, svc *locations.Service) *fiber.App {
	t.Helper()
	app := fiber.New()
	devID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	app.Post(
		"/api/v1/devices/:uuid_firmware/locations",
		func(c fiber.Ctx) error {
			// The real middleware stamps c.Locals(device_id) after the
			// API-key lookup. Tests bypass that, so we fabricate the id.
			c.Locals(middleware.LocalsKeyDeviceID, devID)
			return c.Next()
		},
		middleware.ValidateRequestBody[dto.IngestLocationRequest](),
		handlers.NewLocationsHandler(svc).Ingest,
	)
	return app
}

func doRequest(t *testing.T, app *fiber.App, path string, body any) *http.Response {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req := httptest.NewRequest(http.MethodPost, path, r)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	return resp
}

func validBody() map[string]any {
	return map[string]any{
		"recorded_at":     "2026-07-07T12:00:00Z",
		"latitude":        19.43,
		"longitude":       -99.13,
		"altitude":        2240.5,
		"speed":           45.3,
		"accuracy":        4.1,
		"battery_voltage": 3.72,
		"signal_strength": 23,
	}
}

func TestLocationsHandler_AcceptsValid(t *testing.T) {
	stub := &recordingWriter{}
	svc := locations.New(stub, &recordingReader{})
	app := newApp(t, svc)

	resp := doRequest(t, app, "/api/v1/devices/esp32-001/locations", validBody())
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}
	if stub.calls != 1 {
		t.Errorf("writer called %d times, want 1", stub.calls)
	}
}

func TestLocationsHandler_RejectsInvalidLatitude(t *testing.T) {
	stub := &recordingWriter{}
	svc := locations.New(stub, &recordingReader{})
	app := newApp(t, svc)

	body := validBody()
	body["latitude"] = 200.0
	resp := doRequest(t, app, "/api/v1/devices/esp32-001/locations", body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status=%d, want 400", resp.StatusCode)
	}
	if stub.calls != 0 {
		t.Errorf("writer called %d times on invalid payload", stub.calls)
	}
}

func TestLocationsHandler_RejectsMissingRecordedAt(t *testing.T) {
	stub := &recordingWriter{}
	svc := locations.New(stub, &recordingReader{})
	app := newApp(t, svc)

	body := validBody()
	delete(body, "recorded_at")
	resp := doRequest(t, app, "/api/v1/devices/esp32-001/locations", body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status=%d, want 400 (missing recorded_at)", resp.StatusCode)
	}
}

func TestLocationsHandler_RejectsBadRFC3339(t *testing.T) {
	stub := &recordingWriter{}
	svc := locations.New(stub, &recordingReader{})
	app := newApp(t, svc)

	body := validBody()
	body["recorded_at"] = "not-a-timestamp"
	resp := doRequest(t, app, "/api/v1/devices/esp32-001/locations", body)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status=%d, want 400 (bad RFC3339)", resp.StatusCode)
	}
}

func TestLocationsHandler_AcceptsNilOptionalFields(t *testing.T) {
	stub := &recordingWriter{}
	svc := locations.New(stub, &recordingReader{})
	app := newApp(t, svc)

	body := map[string]any{
		"recorded_at": "2026-07-07T12:00:00Z",
		"latitude":    19.43,
		"longitude":   -99.13,
	}
	resp := doRequest(t, app, "/api/v1/devices/esp32-001/locations", body)
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("status=%d body=%s want 201", resp.StatusCode, body)
	}
}

// recordingReader is the Reader port mock for the Latest handler tests.
// The production tests don't hit the DB; the service layer is wired
// against this struct so each test controls exactly what GetLatest
// returns (a real domain.Location, domain.ErrNotFound, or a generic
// error to verify error mapping).
type recordingReader struct {
	loc domain.Location
	err error
}

func (r *recordingReader) GetLatest(_ context.Context, _ uuid.UUID) (domain.Location, error) {
	return r.loc, r.err
}

func (r *recordingReader) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return nil, 0, nil
}

func (r *recordingReader) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return nil, 0, false, nil
}

// newLatestApp wires just the Latest endpoint onto a fresh Fiber, mirroring
// how newApp isolates Ingest. The route is mounted under
// /api/v1/devices/:id/locations/latest — the production router adds the
// auth + access middlewares, but those touch Authula / Postgres and live
// in their own layers.
func newLatestApp(t *testing.T, svc *locations.Service) *fiber.App {
	t.Helper()
	app := fiber.New()
	// Pretend authSession stamped the local user into locals. The handler
	// only checks for presence, never reads user-scoped data.
	dummyUser := &domain.User{ID: uuid.New(), Email: "test@example.com"}
	app.Get(
		"/api/v1/devices/:id/locations/latest",
		func(c fiber.Ctx) error {
			c.Locals(middleware.LocalsKeyUser, dummyUser)
			return c.Next()
		},
		handlers.NewLocationsHandler(svc).Latest,
	)
	return app
}

func doGetRequest(t *testing.T, app *fiber.App, path string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	return resp
}

// envelope mirrors the response.HTTPResponse shape so the tests can decode
// into something without importing the transport package.
type envelope[T any] struct {
	StatusCode int    `json:"status_code"`
	Message    string `json:"message"`
	Data       T      `json:"data"`
}

func TestLocationsHandler_Latest_ReturnsLocation(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	want := domain.Location{
		DeviceID:   uuid.New(),
		RecordedAt: now,
		Latitude:   19.4326,
		Longitude:  -99.1332,
	}
	r := &recordingReader{loc: want}
	svc := locations.New(&recordingWriter{}, r)
	app := newLatestApp(t, svc)

	resp := doGetRequest(t, app, "/api/v1/devices/"+want.DeviceID.String()+"/locations/latest")
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s", resp.StatusCode, body)
	}

	var env envelope[map[string]any]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.StatusCode != http.StatusOK {
		t.Errorf("status_code=%d want 200", env.StatusCode)
	}
	if got, _ := env.Data["device_id"].(string); got != want.DeviceID.String() {
		t.Errorf("device_id=%v want %v", got, want.DeviceID.String())
	}
	if got, _ := env.Data["latitude"].(float64); got != want.Latitude {
		t.Errorf("latitude=%v want %v", got, want.Latitude)
	}
}

func TestLocationsHandler_Latest_NotFoundWhenNeverReported(t *testing.T) {
	r := &recordingReader{err: domain.ErrNotFound}
	svc := locations.New(&recordingWriter{}, r)
	app := newLatestApp(t, svc)

	resp := doGetRequest(t, app, "/api/v1/devices/"+uuid.New().String()+"/locations/latest")
	if resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s want 404", resp.StatusCode, body)
	}

	var env envelope[any]
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if env.StatusCode != http.StatusNotFound {
		t.Errorf("status_code=%d want 404", env.StatusCode)
	}
	if env.Message == "" {
		t.Error("expected non-empty message on 404")
	}
}

func TestLocationsHandler_Latest_PropagatesUnknownError(t *testing.T) {
	// A non-ErrNotFound reader error must not silently turn into a 404;
	// the httpErrorHandler maps it to a 500 by default.
	r := &recordingReader{err: errors.New("db down")}
	svc := locations.New(&recordingWriter{}, r)
	app := newLatestApp(t, svc)

	resp := doGetRequest(t, app, "/api/v1/devices/"+uuid.New().String()+"/locations/latest")
	if resp.StatusCode == http.StatusNotFound {
		t.Fatalf("status=%d: non-ErrNotFound error must not become 404", resp.StatusCode)
	}
}

func TestLocationsHandler_Latest_RejectsInvalidDeviceID(t *testing.T) {
	svc := locations.New(&recordingWriter{}, &recordingReader{})
	app := newLatestApp(t, svc)

	resp := doGetRequest(t, app, "/api/v1/devices/not-a-uuid/locations/latest")
	if resp.StatusCode != http.StatusBadRequest {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status=%d body=%s want 400", resp.StatusCode, body)
	}
}

func TestLocationsHandler_Latest_RejectsMissingUser(t *testing.T) {
	// Skip the locals-stamping middleware and hit Latest directly. The
	// handler must refuse without an authenticated user even if the rest
	// of the pipeline would have produced one.
	app := fiber.New()
	app.Get(
		"/api/v1/devices/:id/locations/latest",
		handlers.NewLocationsHandler(
			locations.New(&recordingWriter{}, &recordingReader{}),
		).Latest,
	)
	resp := doGetRequest(t, app, "/api/v1/devices/"+uuid.New().String()+"/locations/latest")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status=%d want 401", resp.StatusCode)
	}
}
