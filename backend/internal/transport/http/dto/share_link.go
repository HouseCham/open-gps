package dto

import (
	"time"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type CreateShareLinkRequest struct {
	DurationHours int `json:"duration_hours" validate:"required,oneof=1 2 4 8"`
}

type ConsumeShareLinkRequest struct {
	Token string `json:"token" validate:"required,len=43"`
}

type ShareLinkResponse struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type CreateShareLinkResponse struct {
	ShareLinkResponse
	Token string `json:"token"`
}

type GuestShareSessionResponse struct {
	DeviceName string    `json:"device_name"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type GuestLocationResponse struct {
	RecordedAt time.Time `json:"recorded_at"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
}

type GuestLiveResponse struct {
	DeviceName string                 `json:"device_name"`
	Location   *GuestLocationResponse `json:"location"`
	Presence   GuestPresenceResponse  `json:"presence"`
	ServerTime time.Time              `json:"server_time"`
}

type GuestPresenceResponse struct {
	State domain.PresenceState `json:"state"`
}

func GuestLiveFromDomain(deviceName string, value domain.LiveLocation) GuestLiveResponse {
	var location *GuestLocationResponse
	if value.Location != nil {
		location = &GuestLocationResponse{
			RecordedAt: value.Location.RecordedAt,
			Latitude:   value.Location.Latitude,
			Longitude:  value.Location.Longitude,
		}
	}
	return GuestLiveResponse{
		DeviceName: deviceName,
		Location:   location,
		Presence:   GuestPresenceResponse{State: value.Presence.State},
		ServerTime: value.ServerTime,
	}
}
