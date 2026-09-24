package locations

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// Service validates incoming ingest payloads before persisting them and
// exposes the read use cases for the dashboard's location preview.
//
// The write side only enforces numeric ranges that Postgres cannot
// enforce directly (the DTO already handles "required / type" fields
// via validate_struct); database constraints (NOT NULL on lat/lng, FK
// on device_id, partition key composite PK, idempotent ON CONFLICT)
// live one layer below.
//
// The read side is a thin pass-through to the Reader port — no business
// rules here yet (the device-existence check is enforced upstream by
// the per-route RequireDeviceRole middleware; the service stays
// single-responsibility).
type Service struct {
	writer    Writer
	reader    Reader
	live      LiveReader
	publisher LivePublisher
}

// New constructs a Service backed by a single adapter that satisfies
// both ports. Following the api-keys service convention: pass the
// same adapter twice rather than introducing a combined interface.
func New(w Writer, r Reader, publishers ...LivePublisher) *Service {
	// Not every Reader implements LiveReader; a failed assertion leaves
	// live == nil, which GetLive already reports explicitly.
	live, _ := r.(LiveReader)
	var publisher LivePublisher
	if len(publishers) > 0 {
		publisher = publishers[0]
	}
	return &Service{writer: w, reader: r, live: live, publisher: publisher}
}

const (
	LivePresenceTimeout     = 6 * time.Minute
	MovingSpeedThresholdMPS = 1.0
)

// GetLive returns the current location and derived presence state for a device.
func (s *Service) GetLive(ctx context.Context, deviceID uuid.UUID, now time.Time) (domain.LiveLocation, error) {
	if s.live == nil {
		return domain.LiveLocation{}, errors.New("live location reader unavailable")
	}
	return s.live.GetLive(ctx, deviceID, now, LivePresenceTimeout, MovingSpeedThresholdMPS)
}

// Ingest validates the payload and inserts one location row.
// The DeviceID is set by the IoT auth middleware upstream (it never comes
// from the request body) — the service treats it as authoritative.
//
// Returns one of the Err* sentinels above when a field falls outside its
// plausible physical range. The handler maps ErrInvalidLatitude /
// ErrInvalidLongitude / ErrInvalidAltitude / ErrInvalidSpeed /
// ErrInvalidAccuracy / ErrInvalidBatteryVoltage / ErrInvalidSignalStrength
// to a 400 envelope via the httpErrorHandler.
func (s *Service) Ingest(ctx context.Context, loc domain.Location) error {
	if err := validateRanges(loc); err != nil {
		return err
	}
	if err := s.writer.Insert(ctx, loc); err != nil {
		return fmt.Errorf("Service.Ingest: %w", err)
	}
	if s.publisher != nil && s.live != nil {
		now := time.Now().UTC()
		if snapshot, err := s.live.GetLive(ctx, loc.DeviceID, now, LivePresenceTimeout, MovingSpeedThresholdMPS); err == nil {
			s.publisher.Publish(loc.DeviceID, "location", snapshot)
		}
	}
	return nil
}

type BatchRejection struct {
	SequenceID uint64
	Code       string
}

func (s *Service) IngestBatch(ctx context.Context, items []domain.Location) ([]uint64, []BatchRejection, error) {
	writer, ok := s.writer.(BatchWriter)
	if !ok {
		return nil, nil, errors.New("batch writer unavailable")
	}
	valid := make([]domain.Location, 0, len(items))
	rejected := make([]BatchRejection, 0)
	seen := make(map[uint64]struct{}, len(items))
	for _, item := range items {
		if _, exists := seen[item.SequenceID]; exists {
			rejected = append(rejected, BatchRejection{SequenceID: item.SequenceID, Code: "duplicate_sequence_id"})
			continue
		}
		seen[item.SequenceID] = struct{}{}
		if err := validateLocation(item); err != nil {
			rejected = append(rejected, BatchRejection{SequenceID: item.SequenceID, Code: err.Error()})
			continue
		}
		valid = append(valid, item)
	}
	accepted, err := writer.InsertBatch(ctx, valid)
	if err != nil {
		return nil, rejected, fmt.Errorf("Service.IngestBatch: %w", err)
	}
	return accepted, rejected, nil
}

func validateLocation(loc domain.Location) error {
	if loc.SequenceID == 0 {
		return errors.New("invalid_sequence_id")
	}
	return validateRanges(loc)
}

// validateRanges checks every numeric field against its plausible physical
// range; shared by the single and batch ingest paths. The single path skips
// the sequence-id check — it is optional there (omitempty,gt=0 on the DTO).
func validateRanges(loc domain.Location) error {
	if loc.Latitude < -90 || loc.Latitude > 90 {
		return ErrInvalidLatitude
	}
	if loc.Longitude < -180 || loc.Longitude > 180 {
		return ErrInvalidLongitude
	}
	if loc.Altitude != nil && (*loc.Altitude < MinAltitudeMeters || *loc.Altitude > MaxAltitudeMeters) {
		return ErrInvalidAltitude
	}
	if loc.Speed != nil && *loc.Speed < 0 {
		return ErrInvalidSpeed
	}
	if loc.Accuracy != nil && *loc.Accuracy < 0 {
		return ErrInvalidAccuracy
	}
	if loc.BatteryVoltage != nil && (*loc.BatteryVoltage < 0 || *loc.BatteryVoltage > MaxBatteryVoltage) {
		return ErrInvalidBatteryVoltage
	}
	if loc.SignalStrength != nil && (*loc.SignalStrength < MinSignalStrength || *loc.SignalStrength > MaxSignalStrength) {
		return ErrInvalidSignalStrength
	}
	return nil
}

// GetLatest returns the device's most recent location, or
// domain.ErrNotFound when the device has never reported. The device-
// existence check itself is enforced upstream by RequireDeviceRole;
// returning ErrNotFound here means "the device exists but has not
// pinged yet" — a real, distinct state the UI surfaces as "Never seen".
func (s *Service) GetLatest(ctx context.Context, deviceID uuid.UUID) (domain.Location, error) {
	loc, err := s.reader.GetLatest(ctx, deviceID)
	if err != nil {
		return domain.Location{}, fmt.Errorf("Service.GetLatest: %w", err)
	}
	return loc, nil
}

// GetHistory returns a page of locations in the half-open [from, to) range.
func (s *Service) GetHistory(ctx context.Context, deviceID uuid.UUID, from, to time.Time, page, pageSize int) ([]domain.Location, int, error) {
	offset := (page - 1) * pageSize
	items, total, err := s.reader.GetHistory(ctx, deviceID, from, to, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("Service.GetHistory: %w", err)
	}
	return items, total, nil
}

// GetRoute returns a chronological route bounded by maxPoints. The reader
// reports the original point count and whether it had to sample the route.
func (s *Service) GetRoute(ctx context.Context, deviceID uuid.UUID, from, to time.Time, maxPoints int) ([]domain.Location, int, bool, error) {
	items, total, sampled, err := s.reader.GetRoute(ctx, deviceID, from, to, maxPoints)
	if err != nil {
		return nil, 0, false, fmt.Errorf("Service.GetRoute: %w", err)
	}
	return items, total, sampled, nil
}
