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

// FirstUserRule is the single source of truth for the "first user"
// rule, shared by admin creation (CreateUser) and the signup mirror
// hook (GetOrCreate). The repository invokes it under the bootstrap
// advisory lock so the decision is atomic with the write it drives
// (BA-12):
//   - role: very first user is super_admin; everyone else is user
//     (the caller's requested role is always ignored).
//   - must_change_password: false for the first super_admin (they
//     signed up themselves), true for everyone else (admin-assigned
//     temp password must be rotated on first login).
//   - email_verified: always false at the application layer; the
//     local projection tracks signup state, not inbox verification.
//
// The DB-level partial unique index on role='super_admin' remains
// the belt-and-braces guard if the lock key ever drifts.
func FirstUserRule(hasSuperAdmin bool) (domain.UserRole, bool) {
	if !hasSuperAdmin {
		return domain.UserRoleSuperAdmin, false
	}
	return domain.UserRoleUser, true
}

// CreateUser registers a brand-new user through Authula and the local
// projection. The role argument is ignored: FirstUserRule decides
// (BA-12). Authula runs first and is idempotent on retry (BA-09
// compensation in authulaUserCreator); the local write then lands
// atomically, repairing any partial prior state — including the
// shared-table row Authula just inserted.
func (s *Service) CreateUser(ctx context.Context, email, name, lastname string, role domain.UserRole) (*CreateUserResult, error) {
	password, err := generateRandomPassword()
	if err != nil {
		return nil, fmt.Errorf("generate password: %w", err)
	}

	if err := s.authCreator.CreateUserWithPassword(ctx, name, email, password); err != nil {
		return nil, fmt.Errorf("create authula user: %w", err)
	}

	user, err := s.repo.CreateUser(ctx, email, name, lastname, false, FirstUserRule)
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
// SignupMirrorHook fires, so the GetByEmail fast-path is the common
// case for the first signup. Both branches route the first-user
// decision through the repository, where it runs under the bootstrap
// advisory lock (BA-12): PromoteIfFirstUser for the existing row,
// CreateUser's DecisionFunc for a brand-new one.
//
// This is the *materialization* path, shared by signup (SignupMirrorHook)
// and session login (AuthSession middleware). The invitation-only
// signup gate (BA-15) lives in the hook, NOT here: a legitimate
// existing user who signs in must still be able to materialize their
// local projection.
func (s *Service) GetOrCreate(ctx context.Context, email, name string) (*domain.User, error) {
	if email == "" {
		return nil, fmt.Errorf("%w: email is required", domain.ErrUnauthorized)
	}

	existing, err := s.repo.GetByEmail(ctx, email)
	if err == nil {
		// Row exists (typically because Authula inserted it during
		// the same request). Honor the first-user promotion rule
		// atomically inside the repository.
		return s.repo.PromoteIfFirstUser(ctx, existing.ID)
	}
	if !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}

	// No row yet: insert atomically with the same first-user rule.
	created, err := s.repo.CreateUser(ctx, email, name, "", false, FirstUserRule)
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

	if requestingUser.Role == domain.UserRoleSuperAdmin && requestingUserID == targetUserID {
		return domain.ErrForbidden
	}

	if requestingUser.Role != domain.UserRoleSuperAdmin && requestingUserID != targetUserID {
		return domain.ErrForbidden
	}

	return s.repo.SoftDeleteUser(ctx, targetUserID)
}

// RejectSignup revokes a self-service signup that the invitation-only
// gate (BA-15) turned away: the Authula credentials already exist, so
// the only lever we have is to soft-delete the local projection. The
// AuthSession barrier denies a session to any non-super_admin, so the
// orphaned credential cannot authenticate either way; this just avoids
// leaving a live row behind. Called only from the signup mirror hook.
func (s *Service) RejectSignup(ctx context.Context, userID uuid.UUID) error {
	return s.repo.SoftDeleteUser(ctx, userID)
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
