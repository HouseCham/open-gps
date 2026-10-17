package devices

import (
	"context"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// MaxDevicesPerUser caps how many devices a single user may register.
// Shared devices (where the user is editor/viewer) do NOT count against
// the cap — only devices the user owns. Exceeding it returns
// domain.ErrDeviceLimitReached, surfaced as 403 by the transport layer.
const MaxDevicesPerUser = 10

type Service struct {
	repo Repository
}

func New(repo Repository) *Service {
	return &Service{repo: repo}
}

// ListMine returns the devices the given user has access to.
func (s *Service) ListMine(ctx context.Context, userID uuid.UUID) ([]domain.DeviceWithAccess, error) {
	return s.repo.ListForUser(ctx, userID)
}

// ListMinePaginated returns a paginated list of devices the user has access to,
// with their access role.
func (s *Service) ListMinePaginated(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]domain.DeviceWithAccess, int, error) {
	offset := (page - 1) * pageSize
	return s.repo.ListForUserWithAccessPaginated(ctx, userID, pageSize, offset)
}

func (s *Service) ListForUserPaginated(ctx context.Context, userID uuid.UUID, page, pageSize int) ([]domain.Device, int, error) {
	offset := (page - 1) * pageSize
	return s.repo.ListForUserPaginated(ctx, userID, pageSize, offset)
}

// CountMine returns how many devices the user has access to. Cheap —
// single COUNT(*) — and reusable by sections that only need the total
// (e.g. the profile page, future dashboard counters).
func (s *Service) CountMine(ctx context.Context, userID uuid.UUID) (int, error) {
	return s.repo.CountForUser(ctx, userID)
}

// GetByID returns a single device if the given user has access to it.
// Returns domain.ErrNotFound if the device does not exist OR the user has
// no access (the repository collapses both into "no rows").
func (s *Service) GetByID(ctx context.Context, userID, deviceID uuid.UUID) (*domain.DeviceWithAccess, error) {
	return s.repo.GetByIDForUser(ctx, userID, deviceID)
}

// Create registers a new device and grants the caller owner access to it,
// enforcing the per-user registration cap (MaxDevicesPerUser). The
// repository serializes the count and the insert inside one transaction
// under a per-user advisory lock (BA-12 pattern), so concurrent creates
// for the same user cannot both slip past the cap. Exceeding the cap
// returns domain.ErrDeviceLimitReached.
func (s *Service) Create(ctx context.Context, input CreateInput) (*domain.Device, error) {
	return s.repo.CreateWithOwnerLimit(ctx, input, MaxDevicesPerUser)
}

// Update applies the provided fields to a device. Name is required by the
// DTO; VehicleType is optional (nil pointer means "leave as-is"). The caller
// is responsible for ensuring the authenticated user has at least editor
// access (enforced by HTTP middleware). Returns domain.ErrNotFound if the
// device does not exist or is soft-deleted.
func (s *Service) Update(ctx context.Context, deviceID uuid.UUID, input UpdateInput) (*domain.Device, error) {
	return s.repo.Update(ctx, deviceID, input)
}

// SoftDelete marks the device as deleted by setting deleted_at = NOW().
// The row is NOT physically removed. The caller is responsible for ensuring
// the authenticated user has owner access (enforced by HTTP middleware).
// Idempotent: re-deleting an already-deleted device succeeds silently.
func (s *Service) SoftDelete(ctx context.Context, deviceID uuid.UUID) error {
	return s.repo.SoftDelete(ctx, deviceID)
}
