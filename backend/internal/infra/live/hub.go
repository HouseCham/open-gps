package live

import (
	"sync"
	"sync/atomic"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type Hub struct {
	sequence atomic.Uint64
	mu       sync.Mutex
	subs     map[uuid.UUID]map[uint64]*subscription
}

type subscription struct {
	ch     chan locations.LiveEvent
	once   sync.Once
	device uuid.UUID
	id     uint64
}

// NewHub creates a new hub
func NewHub() *Hub { return &Hub{subs: make(map[uuid.UUID]map[uint64]*subscription)} }

func (h *Hub) NextID() uint64 { return h.sequence.Add(1) }

// Publish sends event to all subscribers
func (h *Hub) Publish(deviceID uuid.UUID, kind string, snapshot domain.LiveLocation) {
	event := locations.LiveEvent{ID: h.sequence.Add(1), Kind: kind, Snapshot: snapshot}
	h.mu.Lock()
	defer h.mu.Unlock()
	for id, sub := range h.subs[deviceID] {
		select {
		case sub.ch <- event:
		default:
			h.removeLocked(deviceID, id, sub)
		}
	}
}
// Subscribe returns a channel that will receive live events for the given deviceID.
func (h *Hub) Subscribe(deviceID uuid.UUID) (<-chan locations.LiveEvent, func()) {
	sub := &subscription{ch: make(chan locations.LiveEvent, 16), device: deviceID}
	h.mu.Lock()
	if h.subs[deviceID] == nil {
		h.subs[deviceID] = make(map[uint64]*subscription)
	}
	sub.id = h.sequence.Add(1)
	h.subs[deviceID][sub.id] = sub
	h.mu.Unlock()
	return sub.ch, func() {
		sub.once.Do(func() {
			h.mu.Lock()
			h.removeLocked(deviceID, sub.id, sub)
			h.mu.Unlock()
		})
	}
}

// removeLocked removes the subscription from the hub and closes its channel. It assumes the caller holds the lock.
func (h *Hub) removeLocked(deviceID uuid.UUID, id uint64, sub *subscription) {
	if current, ok := h.subs[deviceID][id]; ok && current == sub {
		delete(h.subs[deviceID], id)
		close(sub.ch)
		if len(h.subs[deviceID]) == 0 {
			delete(h.subs, deviceID)
		}
	}
}
