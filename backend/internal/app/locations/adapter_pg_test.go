package locations

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/testutil/pgtest"
)

func TestInsertBatchReplayCounterResetAndExpiredKey(t *testing.T) {
	pool := pgtest.NewSchemaPool(t)
	for _, stmt := range []string{
		`CREATE TABLE devices (
			id uuid PRIMARY KEY,
			last_contact_at timestamptz NULL,
			deleted_at timestamptz NULL
		)`,
		`CREATE TABLE location_ingest_keys (
			device_id uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
			sequence_id bigint NOT NULL CHECK (sequence_id > 0),
			recorded_at timestamptz NOT NULL,
			created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (device_id, sequence_id)
		)`,
		`CREATE TABLE locations (
			device_id uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
			recorded_at timestamptz NOT NULL,
			latitude double precision NOT NULL,
			longitude double precision NOT NULL,
			altitude double precision NULL,
			speed double precision NULL,
			accuracy double precision NULL,
			battery_voltage double precision NULL,
			signal_strength smallint NULL,
			PRIMARY KEY (device_id, recorded_at)
		)`,
	} {
		if _, err := pool.Exec(context.Background(), stmt); err != nil {
			t.Fatalf("create locations test schema: %v", err)
		}
	}
	deviceID := uuid.New()
	if _, err := pool.Exec(context.Background(), `INSERT INTO devices (id) VALUES ($1)`, deviceID); err != nil {
		t.Fatalf("insert device: %v", err)
	}
	adapter := NewAdapter(pool)
	baseTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	item := domain.Location{DeviceID: deviceID, SequenceID: 7, RecordedAt: baseTime, Latitude: 10, Longitude: 20}

	accepted, err := adapter.InsertBatch(context.Background(), []domain.Location{item})
	if err != nil || len(accepted) != 1 || accepted[0] != item.SequenceID {
		t.Fatalf("first insert accepted=%v err=%v", accepted, err)
	}

	// Same sequence and timestamp is an idempotent replay. The incoming
	// point differs deliberately: it must not overwrite the persisted fix.
	replay := item
	replay.Latitude = 11
	accepted, err = adapter.InsertBatch(context.Background(), []domain.Location{replay})
	if err != nil || len(accepted) != 1 || accepted[0] != item.SequenceID {
		t.Fatalf("replay accepted=%v err=%v", accepted, err)
	}
	var count int
	var latitude float64
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*), MIN(latitude) FROM locations`).Scan(&count, &latitude); err != nil {
		t.Fatalf("read replay result: %v", err)
	}
	if count != 1 || latitude != item.Latitude {
		t.Fatalf("after replay rows=%d latitude=%v, want 1/%v", count, latitude, item.Latitude)
	}

	// A reused sequence with a new timestamp is a firmware counter reset,
	// not a replay; it rebinds the key and persists the new fix.
	reset := item
	reset.RecordedAt = baseTime.Add(time.Minute)
	reset.Latitude = 12
	accepted, err = adapter.InsertBatch(context.Background(), []domain.Location{reset})
	if err != nil || len(accepted) != 1 || accepted[0] != item.SequenceID {
		t.Fatalf("counter reset accepted=%v err=%v", accepted, err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM locations`).Scan(&count); err != nil {
		t.Fatalf("count reset rows: %v", err)
	}
	if count != 2 {
		t.Fatalf("rows after counter reset=%d, want 2", count)
	}

	// Exercise the same cutoff used by migration 000024 without waiting for
	// the nightly pg_cron schedule.
	if _, err := pool.Exec(context.Background(), `UPDATE location_ingest_keys SET created_at = NOW() - INTERVAL '31 days' WHERE device_id = $1`, deviceID); err != nil {
		t.Fatalf("age idempotency key: %v", err)
	}
	if _, err := pool.Exec(context.Background(), `DELETE FROM location_ingest_keys WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'`); err != nil {
		t.Fatalf("prune expired idempotency key: %v", err)
	}
	fresh := item
	fresh.RecordedAt = baseTime.Add(2 * time.Minute)
	fresh.Latitude = 13
	accepted, err = adapter.InsertBatch(context.Background(), []domain.Location{fresh})
	if err != nil || len(accepted) != 1 || accepted[0] != item.SequenceID {
		t.Fatalf("expired key reuse accepted=%v err=%v", accepted, err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM locations`).Scan(&count); err != nil {
		t.Fatalf("count post-expiration rows: %v", err)
	}
	if count != 3 {
		t.Fatalf("rows after expired-key reuse=%d, want 3", count)
	}
}
