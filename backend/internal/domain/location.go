package domain

import (
	"time"

	"github.com/google/uuid"
)

// Location is the app-layer projection of one row in the locations table.
// It is used for both the ingest path (what the IoT device posts) and the
// read path (what the dashboard requests). Same fields on both sides:
// the wire DTOs already separate concerns at the transport boundary
// (IngestLocationRequest for write, LocationResponse for read), and the
// numeric / nullable semantics match across them.
//
// Nullable fields (Altitude, Speed, Accuracy, BatteryVoltage, SignalStrength)
// stay as *T: zero values from a no-fix GPS cycle are encoded as JSON null
// in the payload, and we do not want to coerce them to 0 (which would
// flatten reporting analytics).
type Location struct {
	DeviceID       uuid.UUID
	SequenceID     uint64
	RecordedAt     time.Time
	Latitude       float64
	Longitude      float64
	Altitude       *float64
	Speed          *float64
	Accuracy       *float64
	BatteryVoltage *float64
	SignalStrength *int
}
