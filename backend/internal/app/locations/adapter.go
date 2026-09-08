package locations

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/infra/postgres"
)

// Adapter implements the locations Writer and Reader ports using
// sqlc-generated queries. The same pool instance backs both —
// sqlc.New(pool) is cheap and stateless.
type Adapter struct {
	pool *pgxpool.Pool
}

// NewAdapter creates a locations adapter backed by the given PostgreSQL pool.
func NewAdapter(pool *pgxpool.Pool) *Adapter {
	return &Adapter{pool: pool}
}

// Insert writes a single location row. Idempotency is enforced at the DB
// layer via ON CONFLICT (device_id, recorded_at) DO NOTHING on the partition
// PK — ESP32 retries do not surface here as duplicates.
//
// sqlc generates signal_strength as *int32 because Postgres returns
// smallints that way; we adapt int → int32 here. The cast is exact
// for the [0, 31] SIM7080G AT+CSQ scale.
func (a *Adapter) Insert(ctx context.Context, loc domain.Location) error {
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return postgres.WrapPgError(err)
	}
	defer tx.Rollback(ctx)
	queries := postgres.New(tx)

	var signalStrength *int32
	if loc.SignalStrength != nil {
		v := int32(*loc.SignalStrength)
		signalStrength = &v
	}

	if err := queries.InsertLocation(ctx, postgres.InsertLocationParams{
		DeviceID:       postgres.PgtypeUUID(loc.DeviceID),
		RecordedAt:     postgres.PgtypeTimestamptz(loc.RecordedAt),
		Latitude:       loc.Latitude,
		Longitude:      loc.Longitude,
		Altitude:       loc.Altitude,
		Speed:          loc.Speed,
		Accuracy:       loc.Accuracy,
		BatteryVoltage: loc.BatteryVoltage,
		SignalStrength: signalStrength,
	}); err != nil {
		return postgres.WrapPgError(err)
	}
	if _, err := tx.Exec(ctx, `UPDATE devices SET last_contact_at = CURRENT_TIMESTAMP WHERE id = $1 AND deleted_at IS NULL`, postgres.PgtypeUUID(loc.DeviceID)); err != nil {
		return postgres.WrapPgError(err)
	}
	return postgres.WrapPgError(tx.Commit(ctx))
}

// GetLive returns the current location and derived presence state for a device.
func (a *Adapter) GetLive(ctx context.Context, deviceID uuid.UUID, now time.Time, timeout time.Duration, motionThreshold float64) (domain.LiveLocation, error) {
	var contact pgtype.Timestamptz
	if err := a.pool.QueryRow(ctx, `SELECT last_contact_at FROM devices WHERE id = $1 AND deleted_at IS NULL`, postgres.PgtypeUUID(deviceID)).Scan(&contact); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.LiveLocation{}, domain.ErrNotFound
		}
		return domain.LiveLocation{}, postgres.WrapPgError(err)
	}
	var last *time.Time
	if contact.Valid {
		value := contact.Time
		last = &value
	}
	var latest *domain.Location
	value, err := a.GetLatest(ctx, deviceID)
	if err == nil {
		latest = &value
	} else if !errors.Is(err, domain.ErrNotFound) {
		return domain.LiveLocation{}, err
	}
	return domain.LiveLocation{DeviceID: deviceID, Location: latest, Presence: domain.DerivePresence(last, latest, now, timeout, motionThreshold), ServerTime: now}, nil
}

// GetLatest returns the most recent location for a device, or
// domain.ErrNotFound when the device has never reported. "No rows"
// maps to ErrNotFound (not a 500) so the handler can answer 404
// without inspecting pgx.ErrNoRows itself.
func (a *Adapter) GetLatest(ctx context.Context, deviceID uuid.UUID) (domain.Location, error) {
	queries := postgres.New(a.pool)
	row, err := queries.GetLatestLocationForDevice(ctx, postgres.PgtypeUUID(deviceID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Location{}, domain.ErrNotFound
		}
		return domain.Location{}, fmt.Errorf("Adapter.GetLatest: %w", err)
	}
	return locationFromRow(row), nil
}

// GetHistory returns a page of locations in the half-open [from, to) range.
func (a *Adapter) GetHistory(ctx context.Context, deviceID uuid.UUID, from, to time.Time, limit, offset int) ([]domain.Location, int, error) {
	queries := postgres.New(a.pool)
	params := postgres.GetLocationsForDeviceParams{
		DeviceID:     postgres.PgtypeUUID(deviceID),
		RecordedAt:   postgres.PgtypeTimestamptz(from),
		RecordedAt_2: postgres.PgtypeTimestamptz(to),
		Limit:        int32(limit),
		Offset:       int32(offset),
	}

	total, err := queries.CountLocationsForDevice(ctx, postgres.CountLocationsForDeviceParams{
		DeviceID:     params.DeviceID,
		RecordedAt:   params.RecordedAt,
		RecordedAt_2: params.RecordedAt_2,
	})
	if err != nil {
		return nil, 0, postgres.WrapPgError(err)
	}

	rows, err := queries.GetLocationsForDevice(ctx, params)
	if err != nil {
		return nil, 0, postgres.WrapPgError(err)
	}

	items := make([]domain.Location, 0, len(rows))
	for _, row := range rows {
		items = append(items, locationFromRow(row))
	}
	return items, int(total), nil
}

// GetRoute returns a chronological, bounded route for the requested range.
func (a *Adapter) GetRoute(ctx context.Context, deviceID uuid.UUID, from, to time.Time, maxPoints int) ([]domain.Location, int, bool, error) {
	queries := postgres.New(a.pool)
	params := postgres.CountLocationsForDeviceParams{
		DeviceID:     postgres.PgtypeUUID(deviceID),
		RecordedAt:   postgres.PgtypeTimestamptz(from),
		RecordedAt_2: postgres.PgtypeTimestamptz(to),
	}
	total, err := queries.CountLocationsForDevice(ctx, params)
	if err != nil {
		return nil, 0, false, postgres.WrapPgError(err)
	}
	rows, err := queries.GetRouteForDevice(ctx, postgres.GetRouteForDeviceParams{
		DeviceID:     postgres.PgtypeUUID(deviceID),
		RecordedAt:   postgres.PgtypeTimestamptz(from),
		RecordedAt_2: postgres.PgtypeTimestamptz(to),
		Ntile:        int32(maxPoints),
	})
	if err != nil {
		return nil, 0, false, postgres.WrapPgError(err)
	}
	if len(rows) == 0 {
		return []domain.Location{}, 0, false, nil
	}

	items := make([]domain.Location, 0, len(rows))
	for _, row := range rows {
		items = append(items, locationFromRow(postgres.Location{
			DeviceID:       row.DeviceID,
			RecordedAt:     row.RecordedAt,
			Latitude:       row.Latitude,
			Longitude:      row.Longitude,
			Altitude:       row.Altitude,
			Speed:          row.Speed,
			Accuracy:       row.Accuracy,
			BatteryVoltage: row.BatteryVoltage,
			SignalStrength: row.SignalStrength,
		}))
	}
	return items, int(total), int(total) > maxPoints, nil
}

// locationFromRow projects a sqlc Location row into the domain.Location
// the application layer reads through. signal_strength arrives as *int32
// (sqlc's choice for Postgres smallint); we widen back to *int at the
// boundary so downstream code never has to think about pgx specifics.
func locationFromRow(row postgres.Location) domain.Location {
	var signalStrength *int
	if row.SignalStrength != nil {
		v := int(*row.SignalStrength)
		signalStrength = &v
	}
	return domain.Location{
		DeviceID:       uuid.UUID(row.DeviceID.Bytes),
		RecordedAt:     row.RecordedAt.Time,
		Latitude:       row.Latitude,
		Longitude:      row.Longitude,
		Altitude:       row.Altitude,
		Speed:          row.Speed,
		Accuracy:       row.Accuracy,
		BatteryVoltage: row.BatteryVoltage,
		SignalStrength: signalStrength,
	}
}
