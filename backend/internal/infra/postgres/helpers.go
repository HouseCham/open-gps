package postgres

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// PgtypeUUID converts a google/uuid.UUID to a pgtype.UUID the sqlc
// queries accept. Exported so app-layer adapters (locations, apikeys)
// don't have to rebuild the conversion.
func PgtypeUUID(u uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: u, Valid: true}
}

// PgtypeTimestamptz converts a time.Time to a pgtype.Timestamptz the
// sqlc queries accept. Callers that need a NULL timestamp can use
// pgtype.Timestamptz{} directly.
func PgtypeTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// PgtypeInterval converts a time.Duration to a pgtype.Interval so it
// can be bound to a Postgres INTERVAL parameter.
func PgtypeInterval(d time.Duration) pgtype.Interval {
	return pgtype.Interval{Microseconds: d.Microseconds(), Valid: true}
}

// UuidFromPgtype is the inverse of PgtypeUUID: returns uuid.Nil when
// the pgtype value is SQL NULL.
func UuidFromPgtype(p pgtype.UUID) uuid.UUID {
	if !p.Valid {
		return uuid.Nil
	}
	return uuid.UUID(p.Bytes)
}

func timestamptzToPtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

// toDomainDevice builds a domain.Device from the common device columns.
// Every sqlc row type for the `devices` table shares this projection, so
// the conversion lives in one place.
func toDomainDevice(id pgtype.UUID, uuidFirmware, name string, vehicleType DeviceVehicleType, createdAt, lastSeenAt pgtype.Timestamptz) *domain.Device {
	return &domain.Device{
		ID:           UuidFromPgtype(id),
		UuidFirmware: uuidFirmware,
		Name:         name,
		VehicleType:  domain.DeviceVehicleType(vehicleType),
		CreatedAt:    createdAt.Time,
		LastSeenAt:   timestamptzToPtr(lastSeenAt),
	}
}
