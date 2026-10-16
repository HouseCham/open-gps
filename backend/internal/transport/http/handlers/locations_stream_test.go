package handlers

import (
	"bufio"
	"context"
	"io"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/infra/live"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
)

// fakeLocationsAdapter implements the locations read/live ports the
// Stream handler needs. Writes are unused in these tests.
type fakeLocationsAdapter struct {
	snapshot domain.LiveLocation
}

func (f *fakeLocationsAdapter) Insert(context.Context, domain.Location) error { return nil }

func (f *fakeLocationsAdapter) GetLatest(context.Context, uuid.UUID) (domain.Location, error) {
	return domain.Location{}, nil
}

func (f *fakeLocationsAdapter) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return nil, 0, nil
}

func (f *fakeLocationsAdapter) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return nil, 0, false, nil
}

func (f *fakeLocationsAdapter) GetLive(context.Context, uuid.UUID, time.Time, time.Duration, float64) (domain.LiveLocation, error) {
	return f.snapshot, nil
}

// startStreamTestApp mounts the authenticated locations stream on a
// real TCP listener so SendStreamWriter takes the production streaming
// path (app.Test buffers responses and would hide lifecycle bugs).
func startStreamTestApp(t *testing.T) (hub *live.Hub, deviceID uuid.UUID, baseURL string, shutdown func()) {
	t.Helper()
	deviceID = uuid.New()
	hub = live.NewHub()
	adapter := &fakeLocationsAdapter{snapshot: domain.LiveLocation{DeviceID: deviceID}}
	svc := locations.New(adapter, adapter, hub)
	h := NewLocationsHandler(svc, hub)

	app := fiber.New()
	app.Use(func(c fiber.Ctx) error {
		c.Locals(middleware.LocalsKeyUser, &domain.User{ID: uuid.New(), Role: domain.UserRoleSuperAdmin})
		return c.Next()
	})
	app.Get("/api/v1/devices/:id/locations/live/stream", h.Stream)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	go func() { _ = app.Listener(ln) }()
	// Graceful shutdown drains open streams, which outlive the client
	// until a keepalive write fails (~25s). Don't let cleanup hang the
	// test on that.
	shutdown = func() {
		done := make(chan struct{})
		go func() { _ = app.Shutdown(); close(done) }()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
		}
	}
	return hub, deviceID, "http://" + ln.Addr().String(), shutdown
}

// closeAndDrain closes the client side of the stream and keeps waking
// the writer with publishes until its write hits the dead connection
// (fasthttp only notices the remote close when it writes — the
// keepalive path in production, event writes here — and the first
// write after FIN can still land in the kernel buffer), then asserts
// the subscription is released.
func closeAndDrain(t *testing.T, hub *live.Hub, deviceID uuid.UUID, body io.Closer) {
	t.Helper()
	_ = body.Close()
	deadline := time.Now().Add(2 * time.Second)
	for hub.SubCount(deviceID) != 0 && time.Now().Before(deadline) {
		hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
		time.Sleep(50 * time.Millisecond)
	}
	if got := hub.SubCount(deviceID); got != 0 {
		t.Fatalf("SubCount after disconnect = %d, want 0 (subscription leaked)", got)
	}
}

// readSSEEvent reads one complete SSE event (terminated by a blank
// line) and returns its `event:` field. Comment/keepalive lines are
// skipped. An io error (stream closed) is returned as-is.
func readSSEEvent(br *bufio.Reader) (string, error) {
	kind := ""
	for {
		line, err := br.ReadString('\n')
		if err != nil {
			return "", err
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			return kind, nil
		}
		if strings.HasPrefix(line, ":") {
			continue // keepalive comment
		}
		if v, ok := strings.CutPrefix(line, "event: "); ok {
			kind = v
		}
	}
}

// streamEvents pumps SSE events from the body into a channel until the
// stream ends (channel close).
func streamEvents(body io.ReadCloser) <-chan string {
	ch := make(chan string, 16)
	br := bufio.NewReader(body)
	go func() {
		defer close(ch)
		for {
			kind, err := readSSEEvent(br)
			if err != nil {
				return
			}
			ch <- kind
		}
	}()
	return ch
}

func waitEvent(t *testing.T, ch <-chan string, want string, timeout time.Duration) {
	t.Helper()
	select {
	case got, ok := <-ch:
		if !ok {
			t.Fatalf("stream closed while waiting for %q event", want)
		}
		if got != want {
			t.Fatalf("event = %q, want %q", got, want)
		}
	case <-time.After(timeout):
		t.Fatalf("timeout waiting for %q event", want)
	}
}

// TestStream_ReceivesPublishedEventAfterHandlerReturns reproduces the
// BA-03 lifetime bug: with unsubscribe deferred on the handler, the
// subscription dies when the handler returns — before the stream
// writer drains it — so any publish after that moment is lost and the
// client only ever saw the snapshot.
func TestStream_ReceivesPublishedEventAfterHandlerReturns(t *testing.T) {
	hub, deviceID, baseURL, shutdown := startStreamTestApp(t)
	defer shutdown()

	resp, err := http.Get(baseURL + "/api/v1/devices/" + deviceID.String() + "/locations/live/stream")
	if err != nil {
		t.Fatalf("get stream: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type = %q, want text/event-stream", ct)
	}

	events := streamEvents(resp.Body)
	waitEvent(t, events, "snapshot", 2*time.Second)

	// Publish AFTER the handler has (long) returned — only the stream
	// writer's subscription can still receive it.
	hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
	waitEvent(t, events, "location", 2*time.Second)

	// Disconnect must release the subscription too.
	closeAndDrain(t, hub, deviceID, resp.Body)
}

// TestStream_ClientDisconnectUnsubscribesAndReconnectWorks asserts the
// cleanup side: closing the client connection must release the hub
// subscription, and a fresh connection must get a working stream again.
func TestStream_ClientDisconnectUnsubscribesAndReconnectWorks(t *testing.T) {
	hub, deviceID, baseURL, shutdown := startStreamTestApp(t)
	defer shutdown()

	url := baseURL + "/api/v1/devices/" + deviceID.String() + "/locations/live/stream"

	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("get stream: %v", err)
	}
	events := streamEvents(resp.Body)
	waitEvent(t, events, "snapshot", 2*time.Second)
	if got := hub.SubCount(deviceID); got != 1 {
		t.Fatalf("SubCount after connect = %d, want 1", got)
	}

	// Client disconnect: the writer must notice and unsubscribe.
	closeAndDrain(t, hub, deviceID, resp.Body)

	// Reconnect: fresh snapshot on a fresh subscription.
	resp2, err := http.Get(url)
	if err != nil {
		t.Fatalf("reconnect: %v", err)
	}
	defer resp2.Body.Close()
	events2 := streamEvents(resp2.Body)
	waitEvent(t, events2, "snapshot", 2*time.Second)
	hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
	waitEvent(t, events2, "location", 2*time.Second)
}
