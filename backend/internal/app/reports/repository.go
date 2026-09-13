package reports

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Filter identifies the authorized report scope and its local-time range.
type Filter struct {
	From        time.Time
	To          time.Time
	DeviceIDs   []uuid.UUID
	VehicleType string
}

// Device is the report-safe identity of an authorized active device.
type Device struct {
	ID          uuid.UUID
	Name        string
	VehicleType string
}

// Point is one complete location row used for report calculations.
type Point struct {
	DeviceID       uuid.UUID
	RecordedAt     time.Time
	Latitude       float64
	Longitude      float64
	Altitude       *float64
	Speed          *float64
	Accuracy       *float64
	BatteryVoltage *float64
	SignalStrength *int
}

// Dataset contains only points belonging to the authenticated user's active devices.
type Dataset struct {
	Devices []Device
	Points  []Point
}

// Repository is the trusted persistence boundary for reports.
type Repository interface {
	GetDataset(ctx context.Context, userID uuid.UUID, filter Filter, limit int) (Dataset, error)
}
