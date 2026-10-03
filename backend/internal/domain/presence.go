package domain

import (
	"time"

	"github.com/google/uuid"
)

type PresenceState string

const (
	PresenceNeverSeen        PresenceState = "never_seen"
	PresenceOnlineMoving     PresenceState = "online_moving"
	PresenceOnlineStationary PresenceState = "online_stationary"
	PresenceOffline          PresenceState = "offline"
)

type DevicePresence struct {
	State         PresenceState
	LastContactAt *time.Time
	ExpiresAt     *time.Time
}

type LiveLocation struct {
	DeviceID   uuid.UUID
	Location   *Location
	Presence   DevicePresence
	ServerTime time.Time
}

// DerivePresence returns the current presence state for the device.
func DerivePresence(lastContactAt *time.Time, latest *Location, now time.Time, timeout time.Duration, motionThresholdMPS float64) DevicePresence {
	if lastContactAt == nil {
		return DevicePresence{State: PresenceNeverSeen}
	}
	expiresAt := lastContactAt.Add(timeout)
	state := PresenceOnlineStationary
	if now.Before(expiresAt) && latest != nil && latest.Speed != nil && *latest.Speed > motionThresholdMPS {
		state = PresenceOnlineMoving
	}
	if !now.Before(expiresAt) {
		state = PresenceOffline
	}
	return DevicePresence{State: state, LastContactAt: lastContactAt, ExpiresAt: &expiresAt}
}
