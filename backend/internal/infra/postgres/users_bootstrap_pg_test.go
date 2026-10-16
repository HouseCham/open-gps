package postgres

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// bootstrapTestDB returns a pool against a dedicated, disposable
// database identified by TEST_DATABASE_URL and resets the shared
// users table (schema mirrors migrations 000002/000003 plus the
// later column additions). Skips when the variable is unset so the
// unit suite stays runnable without Postgres.
func bootstrapTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping PostgreSQL integration test")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	for _, stmt := range []string{
		`DROP TABLE IF EXISTS users CASCADE`,
		`DROP TYPE IF EXISTS user_role CASCADE`,
		`CREATE TYPE user_role AS ENUM ('user', 'super_admin')`,
		`CREATE TABLE users (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			email varchar(255) NOT NULL UNIQUE,
			role user_role NOT NULL DEFAULT 'user',
			created_at timestamptz NOT NULL DEFAULT NOW(),
			updated_at timestamptz NOT NULL DEFAULT NOW(),
			deleted_at timestamptz NULL,
			name varchar(255) NOT NULL DEFAULT '',
			lastname varchar(255) NOT NULL DEFAULT '',
			email_verified boolean NOT NULL DEFAULT false,
			image text NULL,
			must_change_password boolean NOT NULL DEFAULT false
		)`,
		`CREATE UNIQUE INDEX idx_users_one_super_admin
			ON users (role) WHERE role = 'super_admin'`,
		`CREATE INDEX idx_users_active_email ON users (email) WHERE deleted_at IS NULL`,
	} {
		if _, err := pool.Exec(context.Background(), stmt); err != nil {
			t.Fatalf("reset schema: %v", err)
		}
	}
	return pool
}

func countByRole(t *testing.T, pool *pgxpool.Pool, role domain.UserRole) int {
	t.Helper()
	var n int
	err := pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM users WHERE role = $1 AND deleted_at IS NULL`, string(role),
	).Scan(&n)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// insertAuthulaRow mimics Authula's shared-table insert: role='user'
// by SQL DEFAULT, no local decision applied.
func insertAuthulaRow(t *testing.T, pool *pgxpool.Pool, email, name string) {
	t.Helper()
	_, err := pool.Exec(context.Background(),
		`INSERT INTO users (email, name) VALUES ($1, $2)`, email, name)
	if err != nil {
		t.Fatalf("insert authula row: %v", err)
	}
}

// TestBootstrapConcurrentCreatesElectOneSuperAdmin races N first
// signups through the adapter: the advisory lock serializes the
// hasSuperAdmin read with its decision and write, so exactly one
// racer becomes super_admin and every loser lands as a plain user
// (BA-12).
func TestBootstrapConcurrentCreatesElectOneSuperAdmin(t *testing.T) {
	pool := bootstrapTestDB(t)
	adapter := NewUsersAdapter(pool)
	ctx := context.Background()

	const racers = 20
	results := make([]*domain.User, racers)
	errs := make([]error, racers)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range racers {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			email := fmt.Sprintf("racer%d@example.com", i)
			results[i], errs[i] = adapter.CreateUser(ctx, email, fmt.Sprintf("Racer%d", i), "", false, users.FirstUserRule)
		}(i)
	}
	close(start)
	wg.Wait()

	superAdmins := 0
	for i := range racers {
		if errs[i] != nil {
			t.Fatalf("racer %d: %v", i, errs[i])
		}
		u := results[i]
		if u.Role == domain.UserRoleSuperAdmin {
			superAdmins++
			if u.MustChangePassword {
				t.Errorf("super_admin %s: must_change_password=true, want false", u.Email)
			}
		} else if !u.MustChangePassword {
			t.Errorf("user %s: must_change_password=false, want true", u.Email)
		}
	}
	if superAdmins != 1 {
		t.Fatalf("winners: got %d super_admin, want exactly 1", superAdmins)
	}
	if got := countByRole(t, pool, domain.UserRoleSuperAdmin); got != 1 {
		t.Fatalf("db super_admin rows: got %d, want 1", got)
	}
	if got := countByRole(t, pool, domain.UserRoleUser); got != racers-1 {
		t.Fatalf("db user rows: got %d, want %d", got, racers-1)
	}
}

// TestBootstrapConcurrentPromotionsElectOneSuperAdmin stages the
// signup-hook race: Authula already inserted N rows (all role='user')
// and N requests run PromoteIfFirstUser at once. Only the request
// that takes the lock first sees hasSuperAdmin=false; everyone else
// returns their row unchanged (BA-12).
func TestBootstrapConcurrentPromotionsElectOneSuperAdmin(t *testing.T) {
	pool := bootstrapTestDB(t)
	adapter := NewUsersAdapter(pool)
	ctx := context.Background()

	const racers = 20
	ids := make([]uuid.UUID, racers)
	for i := range racers {
		email := fmt.Sprintf("promote%d@example.com", i)
		insertAuthulaRow(t, pool, email, fmt.Sprintf("Promotee%d", i))
		var id string
		if err := pool.QueryRow(ctx, `SELECT id::text FROM users WHERE email = $1`, email).Scan(&id); err != nil {
			t.Fatalf("lookup: %v", err)
		}
		ids[i] = uuid.MustParse(id)
	}

	results := make([]*domain.User, racers)
	errs := make([]error, racers)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range racers {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			results[i], errs[i] = adapter.PromoteIfFirstUser(ctx, ids[i])
		}(i)
	}
	close(start)
	wg.Wait()

	winners := 0
	for i := range racers {
		if errs[i] != nil {
			t.Fatalf("racer %d: %v", i, errs[i])
		}
		if results[i].Role == domain.UserRoleSuperAdmin {
			winners++
			if results[i].MustChangePassword {
				t.Errorf("promoted %s: must_change_password=true, want false", results[i].Email)
			}
		}
	}
	if winners != 1 {
		t.Fatalf("winners: got %d super_admin results, want exactly 1", winners)
	}
	if got := countByRole(t, pool, domain.UserRoleSuperAdmin); got != 1 {
		t.Fatalf("db super_admin rows: got %d, want 1", got)
	}
}

// TestBootstrapRetryRepairsPartialState covers BA-09 at the adapter
// level: a prior attempt inserted the Authula row but died before the
// local projection landed. The retry must converge — promote, repair
// the name, and clear the password-rotation flag — instead of failing
// with "email already in use" forever.
func TestBootstrapRetryRepairsPartialState(t *testing.T) {
	pool := bootstrapTestDB(t)
	adapter := NewUsersAdapter(pool)
	ctx := context.Background()

	// Partial state: Authula user exists, no decision applied.
	insertAuthulaRow(t, pool, "half@created.com", "")

	user, err := adapter.CreateUser(ctx, "half@created.com", "Half", "Created", false, users.FirstUserRule)
	if err != nil {
		t.Fatalf("retry: %v", err)
	}
	if user.Role != domain.UserRoleSuperAdmin {
		t.Errorf("role: got %v, want super_admin (no admin existed)", user.Role)
	}
	if user.Name != "Half" || user.Lastname != "Created" {
		t.Errorf("name repair: got %q %q, want Half Created", user.Name, user.Lastname)
	}
	if user.MustChangePassword {
		t.Error("must_change_password: got true, want false for the first super_admin")
	}
	if got := countByRole(t, pool, domain.UserRoleSuperAdmin); got != 1 {
		t.Fatalf("db super_admin rows: got %d, want 1", got)
	}
}

// authulaSimCreator mimics Authula's shared-table write: it inserts
// the users row with role='user' and no local decision, idempotently
// (the real creator's compensation path makes retries safe too).
type authulaSimCreator struct {
	pool *pgxpool.Pool
}

func (c *authulaSimCreator) CreateUserWithPassword(ctx context.Context, name, email, _ string) error {
	_, err := c.pool.Exec(ctx,
		`INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`, email, name)
	return err
}

// failOnceRepo injects a crash after the creator step but before the
// local write — the boundary that used to strand partial state.
type failOnceRepo struct {
	*UsersAdapter
	failNext bool
}

func (f *failOnceRepo) CreateUser(ctx context.Context, email, name, lastname string, emailVerified bool, decide users.DecisionFunc) (*domain.User, error) {
	if f.failNext {
		f.failNext = false
		return nil, errors.New("injected failure: crash between authula insert and local projection")
	}
	return f.UsersAdapter.CreateUser(ctx, email, name, lastname, emailVerified, decide)
}

// TestBootstrapServiceRetryAfterCrash is the failure-injection test
// from the acceptance criteria: the first admin-create attempt dies
// after Authula's insert, the retry must repair the partial state and
// still elect exactly one super_admin.
func TestBootstrapServiceRetryAfterCrash(t *testing.T) {
	pool := bootstrapTestDB(t)
	repo := &failOnceRepo{UsersAdapter: NewUsersAdapter(pool), failNext: true}
	svc := users.NewService(repo, &authulaSimCreator{pool: pool})
	ctx := context.Background()

	if _, err := svc.CreateUser(ctx, "admin@example.com", "Admin", "One", domain.UserRoleUser); err == nil {
		t.Fatal("first attempt: expected injected failure, got nil")
	}
	// Partial state is real now: Authula row exists, undecided.
	if got := countByRole(t, pool, domain.UserRoleSuperAdmin); got != 0 {
		t.Fatalf("after crash: db super_admin rows = %d, want 0", got)
	}

	result, err := svc.CreateUser(ctx, "admin@example.com", "Admin", "One", domain.UserRoleUser)
	if err != nil {
		t.Fatalf("retry: %v", err)
	}
	if result.User.Role != domain.UserRoleSuperAdmin {
		t.Errorf("role: got %v, want super_admin", result.User.Role)
	}
	if result.TemporaryPassword == "" {
		t.Error("expected a temporary password on retry")
	}
	if got := countByRole(t, pool, domain.UserRoleSuperAdmin); got != 1 {
		t.Fatalf("after retry: db super_admin rows = %d, want 1", got)
	}
	if got := countByRole(t, pool, domain.UserRoleUser); got != 0 {
		t.Fatalf("after retry: db user rows = %d, want 0", got)
	}
}
