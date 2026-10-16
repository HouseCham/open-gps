package handlers

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Authula/authula/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/infra/live"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
)

const (
	testSessionCookie = "test.session_token"
	testSessionToken  = "test-session"
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

// fakeStreamAccess flips the device-grant check on demand (BA-11).
type fakeStreamAccess struct {
	mu  sync.Mutex
	err error
}

func (f *fakeStreamAccess) setErr(err error) { f.mu.Lock(); f.err = err; f.mu.Unlock() }

func (f *fakeStreamAccess) RequireRole(context.Context, uuid.UUID, uuid.UUID, domain.AccessRole) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.err
}

// fakeStreamSessionAuthenticator makes the test session token valid or
// revoked on demand (BA-11).
type fakeStreamSessionAuthenticator struct {
	mu    sync.Mutex
	valid bool
}

func (f *fakeStreamSessionAuthenticator) setValid(valid bool) {
	f.mu.Lock()
	f.valid = valid
	f.mu.Unlock()
}

func (f *fakeStreamSessionAuthenticator) Authenticate(_ context.Context, token string) (*models.Actor, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.valid || token != testSessionToken {
		return nil, errors.New("invalid session")
	}
	return &models.Actor{ID: "authula-test-actor"}, nil
}

// streamTestGuard lets a test revoke the session or the grant while a
// stream is open.
type streamTestGuard struct {
	access  *fakeStreamAccess
	session *fakeStreamSessionAuthenticator
}

func (g *streamTestGuard) revokeSession() { g.session.setValid(false) }
func (g *streamTestGuard) revokeGrant()   { g.access.setErr(domain.ErrForbidden) }

// startStreamTestApp mounts the authenticated locations stream on a
// real TCP listener so SendStreamWriter takes the production streaming
// path (app.Test buffers responses and would hide lifecycle bugs).
// Every request is stamped with the same user so per-user stream caps
// are observable (BA-11).
func startStreamTestApp(t *testing.T) (hub *live.Hub, deviceID uuid.UUID, baseURL string, guard *streamTestGuard, shutdown func()) {
	t.Helper()
	deviceID = uuid.New()
	hub = live.NewHub()
	adapter := &fakeLocationsAdapter{snapshot: domain.LiveLocation{DeviceID: deviceID}}
	svc := locations.New(adapter, adapter, hub)
	sessionAuth := &fakeStreamSessionAuthenticator{valid: true}
	guard = &streamTestGuard{access: &fakeStreamAccess{}, session: sessionAuth}
	h := NewLocationsHandler(svc, hub, guard.access, sessionAuth, testSessionCookie)

	app := fiber.New()
	streamUser := &domain.User{ID: uuid.New(), Role: domain.UserRoleSuperAdmin}
	app.Use(func(c fiber.Ctx) error {
		c.Locals(middleware.LocalsKeyUser, streamUser)
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
	return hub, deviceID, "http://" + ln.Addr().String(), guard, shutdown
}

// streamRequest opens the stream carrying the session cookie the
// handler revalidates on every wake-up (BA-11).
func streamRequest(t *testing.T, url string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.AddCookie(&http.Cookie{Name: testSessionCookie, Value: testSessionToken})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("get stream: %v", err)
	}
	return resp
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

// waitClosed consumes events until the server ends the stream.
func waitClosed(t *testing.T, ch <-chan string, timeout time.Duration) {
	t.Helper()
	deadline := time.After(timeout)
	for {
		select {
		case _, ok := <-ch:
			if !ok {
				return
			}
		case <-deadline:
			t.Fatalf("stream still open after %v (should have been terminated)", timeout)
		}
	}
}

// TestStream_ReceivesPublishedEventAfterHandlerReturns reproduces the
// BA-03 lifetime bug: with unsubscribe deferred on the handler, the
// subscription dies when the handler returns — before the stream
// writer drains it — so any publish after that moment is lost and the
// client only ever saw the snapshot.
func TestStream_ReceivesPublishedEventAfterHandlerReturns(t *testing.T) {
	hub, deviceID, baseURL, _, shutdown := startStreamTestApp(t)
	defer shutdown()

	resp := streamRequest(t, baseURL+"/api/v1/devices/"+deviceID.String()+"/locations/live/stream")
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
	hub, deviceID, baseURL, _, shutdown := startStreamTestApp(t)
	defer shutdown()

	url := baseURL + "/api/v1/devices/" + deviceID.String() + "/locations/live/stream"

	resp := streamRequest(t, url)
	events := streamEvents(resp.Body)
	waitEvent(t, events, "snapshot", 2*time.Second)
	if got := hub.SubCount(deviceID); got != 1 {
		t.Fatalf("SubCount after connect = %d, want 1", got)
	}

	// Client disconnect: the writer must notice and unsubscribe.
	closeAndDrain(t, hub, deviceID, resp.Body)

	// Reconnect: fresh snapshot on a fresh subscription.
	resp2 := streamRequest(t, url)
	defer resp2.Body.Close()
	events2 := streamEvents(resp2.Body)
	waitEvent(t, events2, "snapshot", 2*time.Second)
	hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
	waitEvent(t, events2, "location", 2*time.Second)
}

// TestAuthStreamLimiter_EnforcesCapsAndReleases covers the BA-11 slot
// bookkeeping in isolation: per-user cap, global cap, release, and
// underflow safety.
func TestAuthStreamLimiter_EnforcesCapsAndReleases(t *testing.T) {
	// Per-user cap.
	l := newAuthStreamLimiter()
	user := uuid.New()
	for i := 0; i < maxAuthStreamsPerUser; i++ {
		if !l.acquire(user) {
			t.Fatalf("per-user acquire %d: want success", i)
		}
	}
	if l.acquire(user) {
		t.Fatal("per-user cap not enforced")
	}

	// Release restores the user's budget.
	l.release(user)
	if !l.acquire(user) {
		t.Fatal("release did not free the user's slot")
	}

	// Global cap with distinct users: the count lands exactly on the cap.
	l = newAuthStreamLimiter()
	acquired := 0
	for l.acquire(uuid.New()) {
		acquired++
	}
	if acquired != maxAuthStreams {
		t.Fatalf("global acquires = %d, want %d", acquired, maxAuthStreams)
	}
	if l.acquire(uuid.New()) {
		t.Fatal("global cap not enforced")
	}

	// Extra releases must not panic or corrupt the count.
	l.release(uuid.New())
	l.release(uuid.New())
	l.release(uuid.New())
}

// TestStream_PerUserCapReturns429 opens maxAuthStreamsPerUser streams
// for one user, expects a controlled 429 for the next one, and checks
// the slots come back once the streams close (BA-11).
func TestStream_PerUserCapReturns429(t *testing.T) {
	hub, deviceID, baseURL, _, shutdown := startStreamTestApp(t)
	defer shutdown()
	url := baseURL + "/api/v1/devices/" + deviceID.String() + "/locations/live/stream"

	var bodies []io.ReadCloser
	for i := 0; i < maxAuthStreamsPerUser; i++ {
		resp := streamRequest(t, url)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("stream %d status = %d, want 200", i, resp.StatusCode)
		}
		bodies = append(bodies, resp.Body)
	}

	resp := streamRequest(t, url)
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status over cap = %d, want 429", resp.StatusCode)
	}
	_ = resp.Body.Close()

	// Closing every stream must release the slots: a fresh stream is
	// accepted again. Drain writers the same way closeAndDrain does —
	// release() runs right after the hub unsubscribe, so allow a short
	// retry window.
	for _, b := range bodies {
		_ = b.Close()
	}
	deadline := time.Now().Add(2 * time.Second)
	for hub.SubCount(deviceID) != 0 && time.Now().Before(deadline) {
		hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
		time.Sleep(50 * time.Millisecond)
	}
	if got := hub.SubCount(deviceID); got != 0 {
		t.Fatalf("SubCount after closing = %d, want 0", got)
	}
	for {
		resp2 := streamRequest(t, url)
		if resp2.StatusCode == http.StatusOK {
			_ = resp2.Body.Close()
			break
		}
		_ = resp2.Body.Close()
		if time.Now().After(deadline) {
			t.Fatalf("status after release = %d, want 200", resp2.StatusCode)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// TestStream_RevokedSessionStopsStream asserts BA-11 revocation: once
// the session is invalidated, the next wake-up terminates the stream
// instead of leaking events for the connection's lifetime.
func TestStream_RevokedSessionStopsStream(t *testing.T) {
	hub, deviceID, baseURL, guard, shutdown := startStreamTestApp(t)
	defer shutdown()

	resp := streamRequest(t, baseURL+"/api/v1/devices/"+deviceID.String()+"/locations/live/stream")
	events := streamEvents(resp.Body)
	waitEvent(t, events, "snapshot", 2*time.Second)

	guard.revokeSession()
	// A publish wakes the writer; its revalidation must fail and end
	// the stream (in production the 25s keepalive does the same even
	// without traffic).
	hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
	waitClosed(t, events, 2*time.Second)

	if got := hub.SubCount(deviceID); got != 0 {
		t.Fatalf("SubCount after revoked session = %d, want 0 (subscription leaked)", got)
	}
}

// TestStream_RevokedGrantStopsStream is the access-revoke twin of the
// session test: losing the viewer grant ends the stream at the next
// wake-up.
func TestStream_RevokedGrantStopsStream(t *testing.T) {
	hub, deviceID, baseURL, guard, shutdown := startStreamTestApp(t)
	defer shutdown()

	resp := streamRequest(t, baseURL+"/api/v1/devices/"+deviceID.String()+"/locations/live/stream")
	events := streamEvents(resp.Body)
	waitEvent(t, events, "snapshot", 2*time.Second)

	guard.revokeGrant()
	hub.Publish(deviceID, "location", domain.LiveLocation{DeviceID: deviceID})
	waitClosed(t, events, 2*time.Second)

	if got := hub.SubCount(deviceID); got != 0 {
		t.Fatalf("SubCount after revoked grant = %d, want 0 (subscription leaked)", got)
	}
}
