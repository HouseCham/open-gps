package users

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// CreateUserResult wraps the created user and the temporary password
// assigned during admin creation.
type CreateUserResult struct {
	User              *domain.User
	TemporaryPassword string
}

type Service struct {
	repo        Repository
	authCreator UserCreator
}

func NewService(repo Repository, authCreator UserCreator) *Service {
	return &Service{repo: repo, authCreator: authCreator}
}

func (s *Service) ListUsers(ctx context.Context, excludeUserID uuid.UUID) ([]domain.User, error) {
	return s.repo.ListUsers(ctx, excludeUserID)
}

// CountUsers returns the number of active (non-soft-deleted) users.
// Used by the bootstrap endpoint to decide whether the first-time
// setup flow should be shown.
func (s *Service) CountUsers(ctx context.Context) (int, error) {
	return s.repo.CountUsers(ctx)
}

func (s *Service) GetByID(ctx context.Context, requestingUserID, targetUserID uuid.UUID) (*domain.User, error) {
	targetUser, err := s.repo.GetByID(ctx, targetUserID)
	if err != nil {
		return nil, err
	}

	requestingUser, err := s.repo.GetByID(ctx, requestingUserID)
	if err != nil {
		return nil, err
	}

	if requestingUser.Role == domain.UserRoleSuperAdmin {
		return targetUser, nil
	}

	if requestingUserID == targetUserID {
		return targetUser, nil
	}

	return nil, domain.ErrForbidden
}

func (s *Service) CreateUser(ctx context.Context, email, name, lastname string, role domain.UserRole) (*CreateUserResult, error) {
	hasSuperAdmin, err := s.repo.HasSuperAdmin(ctx)
	if err != nil {
		return nil, err
	}

	// Single source of truth for the "first user" rule, shared with
	// GetOrCreate:
	//   * role: very first user is super_admin; everyone else is
	//     forced to user (the caller's requested role is ignored
	//     once a super_admin exists).
	//   * must_change_password: false for the super_admin (no temp
	//     password involved — they signed up themselves), true for
	//     everyone else (admin-assigned temp password must be
	//     rotated on first login).
	//   * email_verified: always false at the application layer.
	//     The local projection tracks signup state, not inbox
	//     verification. The DB-level partial unique index on
	//     role='super_admin' is the belt-and-braces guard.
	role = domain.UserRoleUser
	mustChangePassword := true
	if !hasSuperAdmin {
		role = domain.UserRoleSuperAdmin
		mustChangePassword = false
	}

	password, err := generateRandomPassword()
	if err != nil {
		return nil, fmt.Errorf("generate password: %w", err)
	}

	if err := s.authCreator.CreateUserWithPassword(ctx, name, email, password); err != nil {
		return nil, fmt.Errorf("create authula user: %w", err)
	}

	user, err := s.repo.CreateUser(ctx, email, name, lastname, role, mustChangePassword, false)
	if err != nil {
		return nil, err
	}

	return &CreateUserResult{User: user, TemporaryPassword: password}, nil
}

// GetOrCreate returns the local user record associated with the given
// email, creating one on the fly if no active record exists.
//
// Authula's email-password signup inserts the user into the shared
// `users` table with role='user' (the SQL DEFAULT) before our
// SignupMirrorHook fires. By the time we get here the row already
// exists, so the GetByEmail fast-path is the common case for the
// first signup. The "promote if first user" check (HasSuperAdmin +
// PromoteToSuperAdmin) covers both branches — the row Authula just
// created, and a brand-new row inserted below — so the
// super_admin invariants are enforced regardless of which path
// Authula takes.
func (s *Service) GetOrCreate(ctx context.Context, email, name string) (*domain.User, error) {
	if email == "" {
		return nil, fmt.Errorf("%w: email is required", domain.ErrUnauthorized)
	}

	existing, err := s.repo.GetByEmail(ctx, email)
	if err == nil {
		// Row exists (typically because Authula inserted it during
		// the same request). Honor the first-user promotion rule.
		return s.promoteIfFirstUser(ctx, existing)
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}

	// No row yet: insert with the same first-user rule, then return.
	hasSuperAdmin, err := s.repo.HasSuperAdmin(ctx)
	if err != nil {
		return nil, err
	}
	role := domain.UserRoleUser
	mustChangePassword := true
	if !hasSuperAdmin {
		role = domain.UserRoleSuperAdmin
		mustChangePassword = false
	}

	created, err := s.repo.CreateUser(ctx, email, name, "", role, mustChangePassword, false)
	if err == nil {
		return created, nil
	}
	// A unique-violation on email means a soft-deleted user
	// already owns the address. Surface that as 401 instead of
	// 409: the caller is not "conflicting" with anything they
	// could act on, they were simply bounced.
	if errors.Is(err, domain.ErrConflict) {
		return nil, domain.ErrUnauthorized
	}
	return nil, err
}

// promoteIfFirstUser applies the "very first user becomes super_admin"
// rule to an already-fetched user. If no super_admin exists in the
// system yet and the user is not already one, it issues an UPDATE
// via PromoteToSuperAdmin and returns the refreshed row. Otherwise it
// returns the user as-is.
func (s *Service) promoteIfFirstUser(ctx context.Context, user *domain.User) (*domain.User, error) {
	hasSuperAdmin, err := s.repo.HasSuperAdmin(ctx)
	if err != nil {
		return nil, err
	}
	if hasSuperAdmin || user.Role == domain.UserRoleSuperAdmin {
		return user, nil
	}
	return s.repo.PromoteToSuperAdmin(ctx, user.ID)
}

func (s *Service) UpdateUser(ctx context.Context, userID uuid.UUID, name, lastname string) (*domain.User, error) {
	return s.repo.UpdateUser(ctx, userID, name, lastname)
}

func (s *Service) SetMustChangePassword(ctx context.Context, userID uuid.UUID, mustChange bool) error {
	return s.repo.SetMustChangePassword(ctx, userID, mustChange)
}

// GetByEmail is the package-level lookup used by flows that need to
// resolve an email address to a local user (e.g. the password-reset
// request endpoint). Thin pass-through to the repo; lives on the
// service so callers don't have to reach into the repository port.
func (s *Service) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	return s.repo.GetByEmail(ctx, email)
}

func (s *Service) SoftDeleteUser(ctx context.Context, requestingUserID, targetUserID uuid.UUID) error {
	requestingUser, err := s.repo.GetByID(ctx, requestingUserID)
	if err != nil {
		return err
	}

	if requestingUser.Role != domain.UserRoleSuperAdmin && requestingUserID != targetUserID {
		return domain.ErrForbidden
	}

	return s.repo.SoftDeleteUser(ctx, targetUserID)
}

// generateRandomPassword generates a cryptographically random
// 32-character hex string (128 bits of entropy).
func generateRandomPassword() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
