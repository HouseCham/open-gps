package live

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

func TestHubScopesEventsAndRemovesSubscribers(t *testing.T) {
	hub := NewHub()
	other, unsubscribeOther := hub.Subscribe(uuid.New())
	defer unsubscribeOther()
	device := uuid.New()
	first, unsubscribe := hub.Subscribe(device)
	defer unsubscribe()
	hub.Publish(device, "location", domain.LiveLocation{DeviceID: device, ServerTime: time.Now()})
	select {
	case event := <-first:
		if event.Snapshot.DeviceID != device || event.ID == 0 {
			t.Fatal("invalid event")
		}
	case <-time.After(time.Second):
		t.Fatal("event was not delivered")
	}
	select {
	case <-other:
		t.Fatal("event crossed device boundary")
	default:
	}
	unsubscribe()
	hub.Publish(device, "location", domain.LiveLocation{DeviceID: device})
}
