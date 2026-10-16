package httptest

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

func streamPath(deviceID uuid.UUID) string {
	return "/api/v1/devices/" + deviceID.String() + "/locations/stream"
}

// TestStreamRoute_RequiresSession walks the real router chain without a
// session cookie: AuthSession must reject before any SSE machinery runs.
func TestStreamRoute_RequiresSession(t *testing.T) {
	ta := NewTestApp()

	req := httptest.NewRequest(http.MethodGet, streamPath(uuid.New()), nil)
	resp, err := ta.App.Test(req)
	if err != nil {
		t.Fatalf("test request: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

// TestStreamRoute_RequiresDeviceGrant walks the real router chain with a
// valid session but no grant on the device: RequireDeviceRole must
// refuse (no access → domain.ErrNotFound → 404).
func TestStreamRoute_RequiresDeviceGrant(t *testing.T) {
	ta := NewTestApp()

	const token = "stream-no-grant"
	ta.SetupUser(token, "authula-no-grant", "nogrant@example.com", "No Grant", domain.UserRoleUser)

	req := httptest.NewRequest(http.MethodGet, streamPath(uuid.New()), nil)
	req.AddCookie(&http.Cookie{Name: ta.SessionCookieName, Value: token})
	resp, err := ta.App.Test(req)
	if err != nil {
		t.Fatalf("test request: %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (no grant)", resp.StatusCode)
	}
}

// TestStreamRoute_SnapshotThroughRealRouter is the BA-11 acceptance
// path: session + password gate + viewer RBAC + handler, served by the
// real router, deliver the initial SSE snapshot. app.Test would block
// until the stream ends on its own, so it is run with FailOnTimeout
// and the snapshot is read from the bytes flushed before the cut.
func TestStreamRoute_SnapshotThroughRealRouter(t *testing.T) {
	ta := NewTestApp()

	const token = "stream-ok"
	userID := ta.SetupUser(token, "authula-stream", "stream@example.com", "Streamer", domain.UserRoleUser)
	device := &domain.Device{ID: uuid.New(), Name: "Test Vehicle", UuidFirmware: "fw-1"}
	ta.AddDevice(userID, device, domain.AccessRoleViewer)

	req := httptest.NewRequest(http.MethodGet, streamPath(device.ID), nil)
	req.AddCookie(&http.Cookie{Name: ta.SessionCookieName, Value: token})
	resp, err := ta.App.Test(req, fiber.TestConfig{
		Timeout:       500 * time.Millisecond,
		FailOnTimeout: false,
	})
	if err != nil {
		t.Fatalf("test request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type = %q, want text/event-stream", ct)
	}

	body := make(chan []byte, 1)
	go func() {
		raw, _ := io.ReadAll(resp.Body)
		body <- raw
	}()
	var raw []byte
	select {
	case raw = <-body:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out reading stream body")
	}
	if !strings.Contains(string(raw), "event: snapshot") {
		t.Fatalf("stream body missing snapshot event, got: %q", raw)
	}
}
