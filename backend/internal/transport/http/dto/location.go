package dto

import (
	"time"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// IngestLocationRequest is the body of POST /api/v1/devices/:uuid_firmware/locations.
// The device sends this on every cycle: one payload per ~30 s with up to 9 telemetry fields.
//
// Latitude and longitude are pointers so `required` means "present in the body"
// rather than "non-zero" (0 is a valid coordinate); gte/lte bound the numeric
// ranges, re-checked by the service. Optional telemetry is nullable: absent ==
// SQL NULL in the column. recorded_at must be an RFC 3339 timestamp.
//
// The DeviceID is NEVER in the body — it is taken from the URL's
// :uuid_firmware, resolved by the IoT auth middleware, and stamped
// onto the row.
type IngestLocationRequest struct {
	SequenceID     uint64   `json:"sequence_id"       validate:"omitempty,gt=0"`
	RecordedAt     string   `json:"recorded_at"     validate:"required,rfc3339"`
	Latitude       *float64 `json:"latitude"        validate:"required,gte=-90,lte=90"`
	Longitude      *float64 `json:"longitude"       validate:"required,gte=-180,lte=180"`
	Altitude       *float64 `json:"altitude"        validate:"omitempty,gte=-500,lte=10000"`
	Speed          *float64 `json:"speed"           validate:"omitempty,gte=0"`
	Accuracy       *float64 `json:"accuracy"        validate:"omitempty,gte=0"`
	BatteryVoltage *float64 `json:"battery_voltage" validate:"omitempty,gte=0,lte=6"`
	SignalStrength *int     `json:"signal_strength" validate:"omitempty,gte=0,lte=31"`
}

const MaxBatchItems = 20

type IngestLocationBatchRequest struct {
	Items []IngestLocationRequest `json:"items" validate:"required,min=1,max=20,dive"`
}

type BatchRejected struct {
	SequenceID uint64 `json:"sequence_id"`
	Code       string `json:"code"`
	Retryable  bool   `json:"retryable"`
}

type IngestLocationBatchResponse struct {
	AcceptedSequenceIDs []uint64        `json:"accepted_sequence_ids"`
	Rejected            []BatchRejected `json:"rejected"`
}

// LocationResponse is one location row returned by the read-side endpoints.
// Nullable telemetry fields stay as *T so a missing sensor reading surfaces as
// JSON null rather than a misleading zero.
//
// Times are serialised to RFC 3339 by Go's time.Time JSON marshaller; the
// frontend's `formatDate` helper parses the same shape.
type LocationResponse struct {
	DeviceID       string    `json:"device_id"`
	RecordedAt     time.Time `json:"recorded_at"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	Altitude       *float64  `json:"altitude"`
	Speed          *float64  `json:"speed"`
	Accuracy       *float64  `json:"accuracy"`
	BatteryVoltage *float64  `json:"battery_voltage"`
	SignalStrength *int      `json:"signal_strength"`
}

type LocationListResponse struct {
	Items      []LocationResponse `json:"items"`
	Pagination PaginationMeta     `json:"pagination"`
}

type LocationRouteResponse struct {
	Items       []LocationResponse `json:"items"`
	TotalPoints int                `json:"total_points"`
	Returned    int                `json:"returned"`
	Sampled     bool               `json:"sampled"`
}

type DevicePresenceResponse struct {
	State         domain.PresenceState `json:"state"`
	LastContactAt *time.Time           `json:"last_contact_at"`
	ExpiresAt     *time.Time           `json:"expires_at"`
}

type LiveLocationResponse struct {
	DeviceID   string                 `json:"device_id"`
	Location   *LocationResponse      `json:"location"`
	Presence   DevicePresenceResponse `json:"presence"`
	ServerTime time.Time              `json:"server_time"`
}

// LiveEventResponse is the shape of a live event sent to the dashboard via SSE.
func LiveLocationFromDomain(value domain.LiveLocation) LiveLocationResponse {
	var location *LocationResponse
	if value.Location != nil {
		item := LocationFromDomain(*value.Location)
		location = &item
	}
	return LiveLocationResponse{DeviceID: value.DeviceID.String(), Location: location, Presence: DevicePresenceResponse{
		State: value.Presence.State, LastContactAt: value.Presence.LastContactAt, ExpiresAt: value.Presence.ExpiresAt,
	}, ServerTime: value.ServerTime}
}

// LocationFromDomain projects a domain.Location into the wire shape
// consumed by the dashboard.
func LocationFromDomain(loc domain.Location) LocationResponse {
	return LocationResponse{
		DeviceID:       loc.DeviceID.String(),
		RecordedAt:     loc.RecordedAt,
		Latitude:       loc.Latitude,
		Longitude:      loc.Longitude,
		Altitude:       loc.Altitude,
		Speed:          loc.Speed,
		Accuracy:       loc.Accuracy,
		BatteryVoltage: loc.BatteryVoltage,
		SignalStrength: loc.SignalStrength,
	}
}
