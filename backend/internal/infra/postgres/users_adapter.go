package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type UsersAdapter struct {
	pool *pgxpool.Pool
	q    *Queries
}

func NewUsersAdapter(pool *pgxpool.Pool) *UsersAdapter {
	return &UsersAdapter{pool: pool, q: New(pool)}
}

func (a *UsersAdapter) ListUsers(ctx context.Context, excludeUserID uuid.UUID) ([]domain.User, error) {
	rows, err := a.q.GetUserList(ctx, PgtypeUUID(excludeUserID))
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.ListUsers: %w", WrapPgError(err))
	}
	result := make([]domain.User, 0, len(rows))
	for _, r := range rows {
		result = append(result, rowToDomain(r))
	}
	return result, nil
}

func (a *UsersAdapter) GetByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	row, err := a.q.GetUserByID(ctx, PgtypeUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.GetByID: %w", WrapPgError(err))
	}
	return rowToDomainPtr(row), nil
}

func (a *UsersAdapter) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	row, err := a.q.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.GetByEmail: %w", WrapPgError(err))
	}
	return rowToDomainPtr(row), nil
}

func (a *UsersAdapter) CreateUser(ctx context.Context, email, name, lastname string, role domain.UserRole, mustChangePassword, emailVerified bool) (*domain.User, error) {
	row, err := a.q.CreateUser(ctx, CreateUserParams{
		Email:              email,
		Name:               name,
		Lastname:           lastname,
		Role:               UserRole(role),
		MustChangePassword: mustChangePassword,
		EmailVerified:      emailVerified,
	})
	if err != nil {
		err = WrapPgError(err)
		if !errors.Is(err, domain.ErrConflict) {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: %w", err)
		}

		user, getErr := a.GetByEmail(ctx, email)
		if getErr != nil {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: get conflicting user: %w", getErr)
		}
		user, err = a.UpdateUser(ctx, user.ID, name, lastname)
		if err != nil {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: update conflicting user: %w", err)
		}
		if err := a.SetMustChangePassword(ctx, user.ID, mustChangePassword); err != nil {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: set password requirement: %w", err)
		}
		user.MustChangePassword = mustChangePassword
		return user, nil
	}
	return rowToDomainPtr(row), nil
}

func (a *UsersAdapter) CountUsers(ctx context.Context) (int, error) {
	row, err := a.q.CountUsers(ctx)
	if err != nil {
		return 0, fmt.Errorf("UsersAdapter.CountUsers: %w", WrapPgError(err))
	}
	return int(row), nil
}

func (a *UsersAdapter) UpdateUser(ctx context.Context, userID uuid.UUID, name, lastname string) (*domain.User, error) {
	row, err := a.q.UpdateUser(ctx, UpdateUserParams{
		ID:       PgtypeUUID(userID),
		Name:     name,
		Lastname: lastname,
	})
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.UpdateUser: %w", WrapPgError(err))
	}
	return rowToDomainPtr(row), nil
}

func (a *UsersAdapter) SetMustChangePassword(ctx context.Context, userID uuid.UUID, mustChange bool) error {
	if err := a.q.SetUserMustChangePassword(ctx, SetUserMustChangePasswordParams{
		ID:                 PgtypeUUID(userID),
		MustChangePassword: mustChange,
	}); err != nil {
		return fmt.Errorf("UsersAdapter.SetMustChangePassword: %w", WrapPgError(err))
	}
	return nil
}

func (a *UsersAdapter) SoftDeleteUser(ctx context.Context, userID uuid.UUID) error {
	if err := a.q.SoftDeleteUser(ctx, PgtypeUUID(userID)); err != nil {
		return fmt.Errorf("UsersAdapter.SoftDeleteUser: %w", WrapPgError(err))
	}
	return nil
}

func (a *UsersAdapter) HasSuperAdmin(ctx context.Context) (bool, error) {
	hasSuperAdmin, err := a.q.HasSuperAdmin(ctx)
	if err != nil {
		return false, fmt.Errorf("UsersAdapter.HasSuperAdmin: %w", WrapPgError(err))
	}
	return hasSuperAdmin, nil
}

func (a *UsersAdapter) PromoteToSuperAdmin(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	row, err := a.q.PromoteToSuperAdmin(ctx, PgtypeUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteToSuperAdmin: %w", WrapPgError(err))
	}
	return rowToDomainPtr(row), nil
}

// rowToDomain maps any sqlc-generated user row (Get/List/Create/Update
// all share the same column shape) to a value-typed domain.User.
type userRow GetUserByIDRow

func rowToDomain(r any) domain.User {
	var row userRow
	switch v := r.(type) {
	case GetUserByIDRow:
		row = userRow(v)
	case GetUserByEmailRow:
		row = userRow(v)
	case GetUserListRow:
		row = userRow(v)
	case CreateUserRow:
		row = userRow(v)
	case UpdateUserRow:
		row = userRow(v)
	case PromoteToSuperAdminRow:
		row = userRow(v)
	default:
		panic(fmt.Sprintf("rowToDomain: unhandled sqlc row type %T", r))
	}
	return newDomainUser(row.ID, row.Email, row.EmailVerified, row.Image, row.Name, row.Lastname, row.Role, row.MustChangePassword, row.CreatedAt, row.UpdatedAt)
}

func rowToDomainPtr[T any](r T) *domain.User {
	u := rowToDomain(r)
	return &u
}

func newDomainUser(
	id pgtype.UUID,
	email string,
	emailVerified bool,
	image *string,
	name, lastname string,
	role UserRole,
	mustChangePassword bool,
	createdAt, updatedAt pgtype.Timestamptz,
) domain.User {
	return domain.User{
		ID:                 UuidFromPgtype(id),
		Email:              email,
		EmailVerified:      emailVerified,
		Image:              image,
		Name:               name,
		Lastname:           lastname,
		Role:               domain.UserRole(role),
		MustChangePassword: mustChangePassword,
		CreatedAt:          createdAt.Time,
		UpdatedAt:          updatedAt.Time,
	}
}
