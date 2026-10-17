package devices

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type mockRepo struct {
	listForUserFn                    func(ctx context.Context, userID uuid.UUID) ([]domain.DeviceWithAccess, error)
	listForUserWithAccessPaginatedFn func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.DeviceWithAccess, int, error)
	listForUserPaginatedFn           func(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Device, int, error)
	countForUserFn                   func(ctx context.Context, userID uuid.UUID) (int, error)
	getByIDForUserFn                 func(ctx context.Context, userID, deviceID uuid.UUID) (*domain.DeviceWithAccess, error)
	createWithOwnerLimitFn           func(ctx context.Context, input CreateInput, maxOwned int) (*domain.Device, error)
	updateFn                         func(ctx context.Context, deviceID uuid.UUID, input UpdateInput) (*domain.Device, error)
	softDeleteFn                     func(ctx context.Context, deviceID uuid.UUID) error
}

func (m *mockRepo) ListForUser(ctx context.Context, userID uuid.UUID) ([]domain.DeviceWithAccess, error) {
	return m.listForUserFn(ctx, userID)
}
func (m *mockRepo) ListForUserWithAccessPaginated(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.DeviceWithAccess, int, error) {
	return m.listForUserWithAccessPaginatedFn(ctx, userID, limit, offset)
}
func (m *mockRepo) ListForUserPaginated(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Device, int, error) {
	return m.listForUserPaginatedFn(ctx, userID, limit, offset)
}
func (m *mockRepo) CountForUser(ctx context.Context, userID uuid.UUID) (int, error) {
	return m.countForUserFn(ctx, userID)
}
func (m *mockRepo) GetByIDForUser(ctx context.Context, userID, deviceID uuid.UUID) (*domain.DeviceWithAccess, error) {
	return m.getByIDForUserFn(ctx, userID, deviceID)
}
func (m *mockRepo) CreateWithOwnerLimit(ctx context.Context, input CreateInput, maxOwned int) (*domain.Device, error) {
	return m.createWithOwnerLimitFn(ctx, input, maxOwned)
}
func (m *mockRepo) Update(ctx context.Context, deviceID uuid.UUID, input UpdateInput) (*domain.Device, error) {
	return m.updateFn(ctx, deviceID, input)
}
func (m *mockRepo) SoftDelete(ctx context.Context, deviceID uuid.UUID) error {
	return m.softDeleteFn(ctx, deviceID)
}

func TestListMine(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("returns devices for user", func(t *testing.T) {
		expected := []domain.DeviceWithAccess{
			{Device: domain.Device{Name: "tracker-1"}, AccessRole: domain.AccessRoleOwner},
		}
		svc := New(&mockRepo{
			listForUserFn: func(_ context.Context, uid uuid.UUID) ([]domain.DeviceWithAccess, error) {
				if uid != userID {
					t.Errorf("expected userID %v, got %v", userID, uid)
				}
				return expected, nil
			},
		})
		got, err := svc.ListMine(ctx, userID)
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 1 || got[0].Name != "tracker-1" {
			t.Errorf("got %+v, want %+v", got, expected)
		}
	})

	t.Run("propagates error", func(t *testing.T) {
		svc := New(&mockRepo{
			listForUserFn: func(_ context.Context, _ uuid.UUID) ([]domain.DeviceWithAccess, error) {
				return nil, domain.ErrNotFound
			},
		})
		_, err := svc.ListMine(ctx, userID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestGetByID(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()
	deviceID := uuid.New()

	t.Run("returns device when user has access", func(t *testing.T) {
		expected := &domain.DeviceWithAccess{
			Device:     domain.Device{ID: deviceID, Name: "gps-1"},
			AccessRole: domain.AccessRoleEditor,
		}
		svc := New(&mockRepo{
			getByIDForUserFn: func(_ context.Context, uid, did uuid.UUID) (*domain.DeviceWithAccess, error) {
				if uid != userID || did != deviceID {
					t.Error("wrong arguments passed to repo")
				}
				return expected, nil
			},
		})
		got, err := svc.GetByID(ctx, userID, deviceID)
		if err != nil {
			t.Fatal(err)
		}
		if got.Name != "gps-1" || got.AccessRole != domain.AccessRoleEditor {
			t.Errorf("got %+v, want %+v", got, expected)
		}
	})

	t.Run("returns nil when no access", func(t *testing.T) {
		svc := New(&mockRepo{
			getByIDForUserFn: func(_ context.Context, _, _ uuid.UUID) (*domain.DeviceWithAccess, error) {
				return nil, domain.ErrNotFound
			},
		})
		_, err := svc.GetByID(ctx, userID, deviceID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestCreate(t *testing.T) {
	ctx := context.Background()
	input := CreateInput{
		UuidFirmware: "abc-123",
		Name:         "new-device",
		OwnerID:      uuid.New(),
	}

	t.Run("creates and returns device", func(t *testing.T) {
		expected := &domain.Device{Name: "new-device"}
		svc := New(&mockRepo{
			createWithOwnerLimitFn: func(_ context.Context, in CreateInput, maxOwned int) (*domain.Device, error) {
				if in != input {
					t.Error("input not forwarded")
				}
				if maxOwned != MaxDevicesPerUser {
					t.Errorf("maxOwned = %d, want %d", maxOwned, MaxDevicesPerUser)
				}
				return expected, nil
			},
		})
		got, err := svc.Create(ctx, input)
		if err != nil {
			t.Fatal(err)
		}
		if got.Name != "new-device" {
			t.Errorf("got %+v, want %+v", got, expected)
		}
	})

	t.Run("propagates repository error", func(t *testing.T) {
		svc := New(&mockRepo{
			createWithOwnerLimitFn: func(_ context.Context, _ CreateInput, _ int) (*domain.Device, error) {
				return nil, domain.ErrConflict
			},
		})
		_, err := svc.Create(ctx, input)
		if !errors.Is(err, domain.ErrConflict) {
			t.Errorf("expected ErrConflict, got %v", err)
		}
	})

	t.Run("returns ErrDeviceLimitReached when user already owns MaxDevicesPerUser", func(t *testing.T) {
		svc := New(&mockRepo{
			createWithOwnerLimitFn: func(_ context.Context, _ CreateInput, maxOwned int) (*domain.Device, error) {
				if maxOwned != MaxDevicesPerUser {
					t.Errorf("maxOwned = %d, want %d", maxOwned, MaxDevicesPerUser)
				}
				return nil, domain.ErrDeviceLimitReached
			},
		})
		_, err := svc.Create(ctx, input)
		if !errors.Is(err, domain.ErrDeviceLimitReached) {
			t.Fatalf("expected ErrDeviceLimitReached, got %v", err)
		}
	})

	t.Run("enforces the cap inside the repository, not the service", func(t *testing.T) {
		// The count and insert must share one transaction (advisory lock);
		// the service just forwards the cap. This asserts the delegation.
		calls := 0
		svc := New(&mockRepo{
			createWithOwnerLimitFn: func(_ context.Context, _ CreateInput, maxOwned int) (*domain.Device, error) {
				calls++
				if maxOwned != MaxDevicesPerUser {
					t.Errorf("maxOwned = %d, want %d", maxOwned, MaxDevicesPerUser)
				}
				return &domain.Device{Name: "new-device"}, nil
			},
		})
		if _, err := svc.Create(ctx, input); err != nil {
			t.Fatalf("expected creation to succeed, got %v", err)
		}
		if calls != 1 {
			t.Errorf("expected exactly one repo call, got %d", calls)
		}
	})
}

func TestUpdate(t *testing.T) {
	ctx := context.Background()
	deviceID := uuid.New()

	t.Run("updates name only when vehicle type is nil", func(t *testing.T) {
		svc := New(&mockRepo{
			updateFn: func(_ context.Context, did uuid.UUID, in UpdateInput) (*domain.Device, error) {
				if did != deviceID {
					t.Errorf("got deviceID %v, want %v", did, deviceID)
				}
				if in.Name != "new-name" {
					t.Errorf("got name %q, want new-name", in.Name)
				}
				if in.VehicleType != nil {
					t.Errorf("got vehicleType %v, want nil", *in.VehicleType)
				}
				return &domain.Device{ID: did, Name: in.Name}, nil
			},
		})
		got, err := svc.Update(ctx, deviceID, UpdateInput{Name: "new-name"})
		if err != nil {
			t.Fatal(err)
		}
		if got.Name != "new-name" {
			t.Errorf("got %s, want new-name", got.Name)
		}
	})

	t.Run("updates name and vehicle type together", func(t *testing.T) {
		vt := domain.DeviceVehicleTypeCar
		svc := New(&mockRepo{
			updateFn: func(_ context.Context, did uuid.UUID, in UpdateInput) (*domain.Device, error) {
				if in.VehicleType == nil || *in.VehicleType != domain.DeviceVehicleTypeCar {
					t.Errorf("expected vehicle_type=car, got %v", in.VehicleType)
				}
				return &domain.Device{ID: did, Name: in.Name, VehicleType: *in.VehicleType}, nil
			},
		})
		got, err := svc.Update(ctx, deviceID, UpdateInput{Name: "new-name", VehicleType: &vt})
		if err != nil {
			t.Fatal(err)
		}
		if got.VehicleType != domain.DeviceVehicleTypeCar {
			t.Errorf("got %s, want car", got.VehicleType)
		}
	})

	t.Run("not found on soft-deleted device", func(t *testing.T) {
		svc := New(&mockRepo{
			updateFn: func(_ context.Context, _ uuid.UUID, _ UpdateInput) (*domain.Device, error) {
				return nil, domain.ErrNotFound
			},
		})
		_, err := svc.Update(ctx, deviceID, UpdateInput{Name: "new-name"})
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestSoftDelete(t *testing.T) {
	ctx := context.Background()
	deviceID := uuid.New()

	t.Run("deletes successfully", func(t *testing.T) {
		svc := New(&mockRepo{
			softDeleteFn: func(_ context.Context, did uuid.UUID) error {
				if did != deviceID {
					t.Error("wrong device id")
				}
				return nil
			},
		})
		if err := svc.SoftDelete(ctx, deviceID); err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("idempotent delete succeeds", func(t *testing.T) {
		svc := New(&mockRepo{
			softDeleteFn: func(_ context.Context, _ uuid.UUID) error {
				return nil
			},
		})
		if err := svc.SoftDelete(ctx, deviceID); err != nil {
			t.Errorf("expected nil for idempotent delete, got %v", err)
		}
	})

	t.Run("propagates repository error", func(t *testing.T) {
		svc := New(&mockRepo{
			softDeleteFn: func(_ context.Context, _ uuid.UUID) error {
				return domain.ErrNotFound
			},
		})
		err := svc.SoftDelete(ctx, deviceID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}
