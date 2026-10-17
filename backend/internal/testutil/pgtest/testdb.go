package pgtest

import (
	"context"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TB is the testing.T surface needed by NewSchemaPool, keeping this helper
// usable from package integration tests without importing testing in runtime code.
type TB interface {
	Helper()
	Skip(...any)
	Fatalf(string, ...any)
	Errorf(string, ...any)
	Cleanup(func())
}

// NewSchemaPool creates a uniquely named schema in a dedicated *_test database
// and returns a pool whose search_path is restricted to that schema. Cleanup
// drops only this schema, never shared application tables.
func NewSchemaPool(t TB) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping PostgreSQL integration test")
		return nil
	}

	baseConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("parse TEST_DATABASE_URL: %v", err)
		return nil
	}
	if !strings.HasSuffix(strings.ToLower(baseConfig.ConnConfig.Database), "_test") {
		t.Fatalf("TEST_DATABASE_URL database %q must end in _test", baseConfig.ConnConfig.Database)
		return nil
	}

	setupCtx, setupCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer setupCancel()
	adminPool, err := pgxpool.NewWithConfig(setupCtx, baseConfig)
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
		return nil
	}
	schema := "test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := adminPool.Exec(setupCtx, "CREATE SCHEMA "+quotedSchema); err != nil {
		adminPool.Close()
		t.Fatalf("create isolated test schema: %v", err)
		return nil
	}

	testConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		_, _ = adminPool.Exec(setupCtx, "DROP SCHEMA "+quotedSchema+" CASCADE")
		adminPool.Close()
		t.Fatalf("parse test pool config: %v", err)
		return nil
	}
	if testConfig.ConnConfig.RuntimeParams == nil {
		testConfig.ConnConfig.RuntimeParams = make(map[string]string)
	}
	testConfig.ConnConfig.RuntimeParams["search_path"] = schema
	testPool, err := pgxpool.NewWithConfig(setupCtx, testConfig)
	if err != nil {
		_, _ = adminPool.Exec(setupCtx, "DROP SCHEMA "+quotedSchema+" CASCADE")
		adminPool.Close()
		t.Fatalf("connect to isolated test schema: %v", err)
		return nil
	}

	t.Cleanup(func() {
		testPool.Close()
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := adminPool.Exec(cleanupCtx, "DROP SCHEMA "+quotedSchema+" CASCADE"); err != nil {
			t.Errorf("drop isolated test schema: %v", err)
		}
		adminPool.Close()
	})
	return testPool
}
