package devices

import (
	"context"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// CreateInput carries the data needed to create a device.
// The caller (typically the service) is responsible for business rules;
// the repository handles persistence and the implicit owner access grant.
type CreateInput struct {
	UuidFirmware string
	Name         string
	VehicleType  domain.DeviceVehicleType
	OwnerID      uuid.UUID
}

// UpdateInput carries the fields an editor is allowed to change. Nil
// pointer means "leave as-is" for that field; the DTO enforces which
// fields are present in the request body.
type UpdateInput struct {
	Name        string
	VehicleType *domain.DeviceVehicleType
}

// Lister is the read port for collection-shaped device queries
// (listing and counting).
type Lister interface {
	ListForUser(ctx context.Context, userID uuid.UUID) ([]domain.DeviceWithAccess, error)
	ListForUserWithAccessPaginated(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.DeviceWithAccess, int, error)
	ListForUserPaginated(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Device, int, error)
	CountForUser(ctx context.Context, userID uuid.UUID) (int, error)
}

// Getter is the read port for single-device lookups.
type Getter interface {
	GetByIDForUser(ctx context.Context, userID, deviceID uuid.UUID) (*domain.DeviceWithAccess, error)
}

// Writer is the write port for device mutations.
type Writer interface {
	// CreateWithOwnerLimit registers a device and grants the caller owner
	// access, atomically enforcing that the owner does not already own
	// maxOwned devices. The repository serializes the count and the insert
	// (e.g. under a per-user advisory lock) so concurrent creates cannot
	// exceed the cap. Returns domain.ErrDeviceLimitReached when the owner
	// already owns maxOwned devices.
	CreateWithOwnerLimit(ctx context.Context, input CreateInput, maxOwned int) (*domain.Device, error)
	Update(ctx context.Context, deviceID uuid.UUID, input UpdateInput) (*domain.Device, error)
	SoftDelete(ctx context.Context, deviceID uuid.UUID) error
}

// Repository is the full port the service layer depends on; it
// composes the read and write halves so callers can take either
// one or all three depending on what they need.
type Repository interface {
	Lister
	Getter
	Writer
}
