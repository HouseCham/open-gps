package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/devices"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/testutil/pgtest"
)

func newDevicesLimitAdapter(t *testing.T) *DevicesAdapter {
	t.Helper()
	pool := pgtest.NewSchemaPool(t)
	for _, stmt := range []string{
		`CREATE TYPE device_vehicle_type AS ENUM ('bicycle', 'motorcycle', 'car', 'truck', 'van', 'other')`,
		`CREATE TABLE devices (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			uuid_firmware varchar(36) NOT NULL UNIQUE,
			name varchar(255) NOT NULL,
			vehicle_type device_vehicle_type NOT NULL DEFAULT 'other',
			created_at timestamptz NOT NULL DEFAULT NOW(),
			last_contact_at timestamptz NULL,
			deleted_at timestamptz NULL
		)`,
		`CREATE TABLE user_device_access (
			user_id uuid NOT NULL,
			device_id uuid NOT NULL REFERENCES devices(id),
			role varchar(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
			created_at timestamptz NOT NULL DEFAULT NOW(),
			deleted_at timestamptz NULL,
			PRIMARY KEY (user_id, device_id)
		)`,
	} {
		if _, err := pool.Exec(context.Background(), stmt); err != nil {
			t.Fatalf("create devices test schema: %v", err)
		}
	}
	return NewDevicesAdapter(pool)
}

func TestCreateWithOwnerLimitConcurrentRequestsRespectCap(t *testing.T) {
	adapter := newDevicesLimitAdapter(t)
	ctx := context.Background()
	ownerID := uuid.New()
	for i := 0; i < devices.MaxDevicesPerUser-1; i++ {
		_, err := adapter.CreateWithOwnerLimit(ctx, devices.CreateInput{
			UuidFirmware: uuid.NewString(),
			Name:         fmt.Sprintf("seed-%d", i),
			VehicleType:  domain.DeviceVehicleTypeCar,
			OwnerID:      ownerID,
		}, devices.MaxDevicesPerUser)
		if err != nil {
			t.Fatalf("seed device %d: %v", i, err)
		}
	}

	const racers = 20
	start := make(chan struct{})
	results := make([]error, racers)
	var wg sync.WaitGroup
	for i := range racers {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			_, results[i] = adapter.CreateWithOwnerLimit(ctx, devices.CreateInput{
				UuidFirmware: uuid.NewString(),
				Name:         fmt.Sprintf("racer-%d", i),
				VehicleType:  domain.DeviceVehicleTypeCar,
				OwnerID:      ownerID,
			}, devices.MaxDevicesPerUser)
		}(i)
	}
	close(start)
	wg.Wait()

	created := 0
	for i, err := range results {
		switch {
		case err == nil:
			created++
		case errors.Is(err, domain.ErrDeviceLimitReached):
		default:
			t.Fatalf("racer %d: unexpected error: %v", i, err)
		}
	}
	if created != 1 {
		t.Fatalf("concurrent creates succeeded=%d, want exactly 1", created)
	}
	count, err := New(adapter.pool).CountOwnedDevicesForUser(ctx, PgtypeUUID(ownerID))
	if err != nil {
		t.Fatalf("count owned devices: %v", err)
	}
	if count != devices.MaxDevicesPerUser {
		t.Fatalf("owned devices=%d, want cap %d", count, devices.MaxDevicesPerUser)
	}
}

func TestRegisterIPAttemptConcurrentRequestsRespectCap(t *testing.T) {
	pool := pgtest.NewSchemaPool(t)
	if _, err := pool.Exec(context.Background(), `CREATE TABLE password_reset_attempts (
		id bigserial PRIMARY KEY,
		ip_address text NOT NULL,
		created_at timestamptz NOT NULL DEFAULT NOW()
	)`); err != nil {
		t.Fatalf("create attempts table: %v", err)
	}
	adapter := NewPasswordResetTokensAdapter(pool)

	const (
		racers = 20
		limit  = 10
		ip     = "203.0.113.10"
	)
	start := make(chan struct{})
	allowed := make([]bool, racers)
	errs := make([]error, racers)
	var wg sync.WaitGroup
	for i := range racers {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			allowed[i], errs[i] = adapter.RegisterIPAttempt(context.Background(), ip, 15*time.Minute, limit)
		}(i)
	}
	close(start)
	wg.Wait()

	allowedCount := 0
	for i, err := range errs {
		if err != nil {
			t.Fatalf("request %d: %v", i, err)
		}
		if allowed[i] {
			allowedCount++
		}
	}
	if allowedCount != limit {
		t.Fatalf("allowed requests=%d, want %d", allowedCount, limit)
	}
	if ok, err := adapter.RegisterIPAttempt(context.Background(), "203.0.113.11", 15*time.Minute, limit); err != nil || !ok {
		t.Fatalf("independent IP allowed=%v err=%v, want true/nil", ok, err)
	}
	if ok, err := adapter.RegisterIPAttempt(context.Background(), ip, 15*time.Minute, limit); err != nil || ok {
		t.Fatalf("capped IP allowed=%v err=%v, want false/nil", ok, err)
	}
}
