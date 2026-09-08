package locations

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// Writer is the write port for the locations package. The IoT ingest
// path only needs to insert; reads live in other packages (devices, users).
type Writer interface {
	Insert(ctx context.Context, loc domain.Location) error
}

// Reader is the read port for the locations package. The dashboard uses
// GetLatest for its preview and GetHistory for detective-mode time ranges.
type Reader interface {
	GetLatest(ctx context.Context, deviceID uuid.UUID) (domain.Location, error)
	GetHistory(ctx context.Context, deviceID uuid.UUID, from, to time.Time, limit, offset int) ([]domain.Location, int, error)
	GetRoute(ctx context.Context, deviceID uuid.UUID, from, to time.Time, maxPoints int) ([]domain.Location, int, bool, error)
}

// LiveReader is the read port for current location and presence state.
type LiveReader interface {
	GetLive(ctx context.Context, deviceID uuid.UUID, now time.Time, timeout time.Duration, motionThreshold float64) (domain.LiveLocation, error)
}

// Errors returned by the ingest service. The handlers translate these
// into 400 envelopes; downstream tests assert against them too.
var (
	// ErrInvalidLatitude is returned when latitude falls outside [-90, 90].
	ErrInvalidLatitude = errors.New("invalid latitude")
	// ErrInvalidLongitude is returned when longitude falls outside [-180, 180].
	ErrInvalidLongitude = errors.New("invalid longitude")
	// ErrInvalidAltitude is returned when altitude falls outside the plausible
	// physical range. Sea-level to Everest peak + a generous safety margin.
	ErrInvalidAltitude = errors.New("invalid altitude")
	// ErrInvalidSpeed is returned when speed is negative.
	ErrInvalidSpeed = errors.New("invalid speed")
	// ErrInvalidAccuracy is returned when accuracy is negative.
	ErrInvalidAccuracy = errors.New("invalid accuracy")
	// ErrInvalidBatteryVoltage is returned when battery voltage is outside
	// [0, 6] V. The LiPo is 3.7 V nominal; 6 V is a safe ceiling.
	ErrInvalidBatteryVoltage = errors.New("invalid battery voltage")
	// ErrInvalidSignalStrength is returned when signal_strength is outside
	// the [0, 31] range the SIM7080G AT+CSQ response uses.
	ErrInvalidSignalStrength = errors.New("invalid signal strength")
)

// Numeric range constants for the sanity-check layer. Exported so the
// DTO `validate:` tags and the docs can reference the same numbers.
const (
	// MaxAltitudeMeters is the upper bound for the altitude sanity check.
	MaxAltitudeMeters = 10000.0
	// MinAltitudeMeters is the lower bound. Dead Sea is ~-430 m; -500 m is a
	// generous buffer for indoor mines / submarines in case those exist.
	MinAltitudeMeters = -500.0
	// MaxBatteryVoltage is the upper bound for the battery reading.
	MaxBatteryVoltage = 6.0
	// MinSignalStrength / MaxSignalStrength follow the SIM7080G AT+CSQ scale.
	MinSignalStrength = 0
	MaxSignalStrength = 31
)
