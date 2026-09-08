package domain

import (
	"testing"
	"time"
)

func TestDerivePresence(t *testing.T) {
	now := time.Date(2026, 9, 7, 18, 0, 0, 0, time.UTC)
	if got := DerivePresence(nil, nil, now, 6*time.Minute, 1).State; got != PresenceNeverSeen {
		t.Fatalf("got %q", got)
	}
	contact := now.Add(-5 * time.Minute)
	speed := 2.0
	latest := &Location{Speed: &speed}
	if got := DerivePresence(&contact, latest, now, 6*time.Minute, 1).State; got != PresenceOnlineMoving {
		t.Fatalf("got %q", got)
	}
	if got := DerivePresence(&contact, nil, now, 6*time.Minute, 1).State; got != PresenceOnlineStationary {
		t.Fatalf("got %q", got)
	}
	contact = now.Add(-6 * time.Minute)
	if got := DerivePresence(&contact, latest, now, 6*time.Minute, 1).State; got != PresenceOffline {
		t.Fatalf("got %q", got)
	}
}
