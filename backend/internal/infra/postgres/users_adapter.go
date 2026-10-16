package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
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

func (a *UsersAdapter) CreateUser(ctx context.Context, email, name, lastname string, emailVerified bool, decide users.DecisionFunc) (*domain.User, error) {
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Serialize the first-user decision with its write so two racing
	// signups cannot both observe hasSuperAdmin=false and both try to
	// become super_admin (BA-12).
	if _, err := tx.Exec(ctx, lockBootstrapSQL, bootstrapLockKey); err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: lock: %w", WrapPgError(err))
	}

	q := New(tx)
	hasSuperAdmin, err := q.HasSuperAdmin(ctx)
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: %w", WrapPgError(err))
	}
	role, mustChangePassword := decide(hasSuperAdmin)

	// Savepoint so the repair path can keep using this transaction
	// after the INSERT fails: PostgreSQL aborts the whole transaction
	// on any error (SQLSTATE 25P02) and rejects further statements.
	const savepoint = "users_create"
	if _, err := tx.Exec(ctx, `SAVEPOINT `+savepoint); err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: savepoint: %w", WrapPgError(err))
	}

	row, err := q.CreateUser(ctx, CreateUserParams{
		Email:              email,
		Name:               name,
		Lastname:           lastname,
		Role:               UserRole(role),
		MustChangePassword: mustChangePassword,
		EmailVerified:      emailVerified,
	})
	if err != nil {
		wrapped := WrapPgError(err)
		if !errors.Is(wrapped, domain.ErrConflict) {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: %w", wrapped)
		}
		if _, err := tx.Exec(ctx, `ROLLBACK TO SAVEPOINT `+savepoint); err != nil {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: rollback insert: %w", WrapPgError(err))
		}
		user, repairErr := repairConflictingUser(ctx, q, email, name, lastname, role, mustChangePassword)
		if repairErr != nil {
			return nil, repairErr
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: commit tx: %w", err)
		}
		return user, nil
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: commit tx: %w", err)
	}
	return rowToDomainPtr(row), nil
}

// bootstrapLockKey namespaces the advisory lock that serializes the
// first-super_admin decision with its write (BA-12). Same hashtext
// convention as the password-reset locks. Changing the key is safe:
// every decision path uses this one constant.
// ponytail: raw Exec instead of a sqlc query — one statement, avoids
// sqlc regen churn (users.sql.go is hand-stable).
const bootstrapLockKey = "users:bootstrap"

const lockBootstrapSQL = `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`

// repairConflictingUser converges a conflicting users row to the
// state this request would have produced, inside the caller's
// transaction (lock already held). Two sources land here (BA-09):
// the shared-table Authula insert (role='user' by SQL DEFAULT, the
// common admin-create case), and a retry after a partial prior
// failure. The decided role is applied too — the old repair path
// silently dropped it, so a first-user decision never reached an
// existing row.
func repairConflictingUser(ctx context.Context, q *Queries, email, name, lastname string, role domain.UserRole, mustChangePassword bool) (*domain.User, error) {
	existing, err := q.GetUserByEmail(ctx, email)
	if err != nil {
		// Active row absent → a soft-deleted user owns the address.
		// no-rows propagates as domain.ErrNotFound; GetOrCreate maps
		// its own outcomes.
		return nil, fmt.Errorf("UsersAdapter.CreateUser: get conflicting user: %w", WrapPgError(err))
	}

	updated, err := q.UpdateUser(ctx, UpdateUserParams{ID: existing.ID, Name: name, Lastname: lastname})
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: update conflicting user: %w", WrapPgError(err))
	}

	if role == domain.UserRoleSuperAdmin {
		promoted, err := q.PromoteToSuperAdmin(ctx, existing.ID)
		if err != nil {
			return nil, fmt.Errorf("UsersAdapter.CreateUser: promote conflicting user: %w", WrapPgError(err))
		}
		return rowToDomainPtr(promoted), nil
	}

	if err := q.SetUserMustChangePassword(ctx, SetUserMustChangePasswordParams{
		ID:                 existing.ID,
		MustChangePassword: mustChangePassword,
	}); err != nil {
		return nil, fmt.Errorf("UsersAdapter.CreateUser: set password requirement: %w", WrapPgError(err))
	}
	updated.MustChangePassword = mustChangePassword
	return rowToDomainPtr(updated), nil
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

// PromoteIfFirstUser promotes userID to super_admin when no active
// super_admin exists yet — the existing-row branch of the first-user
// rule (BA-12). The read, the decision, and the update share the
// bootstrap advisory lock with CreateUser, so racing signups
// serialize and exactly one wins the promotion (the partial unique
// index idx_users_one_super_admin stays as the belt-and-braces
// guard).
func (a *UsersAdapter) PromoteIfFirstUser(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, lockBootstrapSQL, bootstrapLockKey); err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: lock: %w", WrapPgError(err))
	}

	q := New(tx)
	user, err := q.GetUserByID(ctx, PgtypeUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: %w", WrapPgError(err))
	}

	hasSuperAdmin, err := q.HasSuperAdmin(ctx)
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: %w", WrapPgError(err))
	}
	if hasSuperAdmin {
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: commit tx: %w", err)
		}
		return rowToDomainPtr(user), nil
	}

	promoted, err := q.PromoteToSuperAdmin(ctx, PgtypeUUID(userID))
	if err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: %w", WrapPgError(err))
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("UsersAdapter.PromoteIfFirstUser: commit tx: %w", err)
	}
	return rowToDomainPtr(promoted), nil
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
