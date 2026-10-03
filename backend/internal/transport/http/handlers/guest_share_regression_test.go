package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
)

func TestGuestStreamLimitReturnsTooManyRequests(t *testing.T) {
	for len(guestStreams) < cap(guestStreams) {
		guestStreams <- struct{}{}
	}
	defer func() {
		for len(guestStreams) > 0 {
			<-guestStreams
		}
	}()

	app := fiber.New()
	app.Get("/stream", (&GuestShareHandler{}).Stream)
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/stream", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status=%d, want 429", resp.StatusCode)
	}
}

func TestExpiredPresenceDeadlinesDoNotScheduleImmediateRefreshes(t *testing.T) {
	expired := time.Now().Add(-time.Second)
	timer := presenceTimer(&expired)
	defer timer.Stop()
	assertTimerNotReady(t, timer)

	resetTimer(timer, &expired)
	assertTimerNotReady(t, timer)
}

func assertTimerNotReady(t *testing.T, timer *time.Timer) {
	t.Helper()
	select {
	case <-timer.C:
		t.Fatal("expired deadline scheduled an immediate refresh")
	default:
	}
}
