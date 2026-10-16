package users

import (
	"context"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// Reader exposes read-only lookups for users.
type Reader interface {
	ListUsers(ctx context.Context, excludeUserID uuid.UUID) ([]domain.User, error)
	GetByID(ctx context.Context, userID uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
}

// DecisionFunc receives whether an active super_admin already exists
// (read by the repository under its bootstrap advisory lock) and
// returns the role and must_change_password to apply. See
// FirstUserRule in service.go for the single policy implementation.
type DecisionFunc func(hasSuperAdmin bool) (domain.UserRole, bool)

// Writer exposes mutation operations on user records.
type Writer interface {
	// CreateUser inserts the local projection atomically with the
	// first-user decision: it locks, reads hasSuperAdmin, calls
	// decide, then writes. A conflicting email (the shared-table
	// Authula row, or a retry after a partial failure) is repaired
	// in place instead of failing — see BA-09 in the remediation
	// plan. The atomic decision closes the BA-12 check-then-write
	// window.
	CreateUser(ctx context.Context, email, name, lastname string, emailVerified bool, decide DecisionFunc) (*domain.User, error)
	UpdateUser(ctx context.Context, userID uuid.UUID, name, lastname string) (*domain.User, error)
	SetMustChangePassword(ctx context.Context, userID uuid.UUID, mustChange bool) error
	SoftDeleteUser(ctx context.Context, userID uuid.UUID) error
}

// Counter exposes count/aggregate queries used by bootstrap flows.
type Counter interface {
	CountUsers(ctx context.Context) (int, error)
}

// Promoter exposes the super_admin promotion path used by the
// first-user bootstrap flow in GetOrCreate.
type Promoter interface {
	// PromoteIfFirstUser promotes userID to super_admin when no
	// active super_admin exists yet, atomically under the same
	// bootstrap advisory lock as CreateUser. Returns the user
	// unchanged when one already exists or userID already is one.
	PromoteIfFirstUser(ctx context.Context, userID uuid.UUID) (*domain.User, error)
}

// Repository is the full set of persistence operations for users.
// It composes Reader + Writer + Counter + Promoter so a single
// implementation (e.g. UsersAdapter) satisfies the whole surface;
// callers that only need a subset should depend on the narrower
// role interface above.
type Repository interface {
	Reader
	Writer
	Counter
	Promoter
}
