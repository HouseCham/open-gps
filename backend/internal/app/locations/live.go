package locations

import (
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type LiveEvent struct {
	ID       uint64
	Kind     string
	Snapshot domain.LiveLocation
}

type LivePublisher interface {
	Publish(deviceID uuid.UUID, kind string, snapshot domain.LiveLocation)
}

type LiveSubscriber interface {
	Subscribe(deviceID uuid.UUID) (<-chan LiveEvent, func())
	NextID() uint64
}
