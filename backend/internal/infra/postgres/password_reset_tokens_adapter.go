package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/app/passwordreset"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// PasswordResetTokensAdapter implements passwordreset.TokenStore and
// passwordreset.RateLimitCounter against the password_reset_tokens and
// password_reset_attempts tables. One row per token; the sha256 hash is
// what the DB stores, the raw token only exists in the email.
type PasswordResetTokensAdapter struct {
	pool *pgxpool.Pool
}

func NewPasswordResetTokensAdapter(pool *pgxpool.Pool) *PasswordResetTokensAdapter {
	return &PasswordResetTokensAdapter{pool: pool}
}

// rowToToken maps the sqlc-generated row to the app-layer Token.
func (a *PasswordResetTokensAdapter) rowToToken(r PasswordResetToken) passwordreset.Token {
	var usedAt *time.Time
	if r.UsedAt.Valid {
		t := r.UsedAt.Time
		usedAt = &t
	}
	return passwordreset.Token{
		ID:        UuidFromPgtype(r.ID),
		UserID:    UuidFromPgtype(r.UserID),
		TokenHash: r.TokenHash,
		IPAddress: r.IpAddress,
		ExpiresAt: r.ExpiresAt.Time,
		UsedAt:    usedAt,
		CreatedAt: r.CreatedAt.Time,
	}
}

// InsertIfUnderLimit issues a fresh token while the per-user cap has
// room, invalidating prior outstanding tokens so only the freshest
// link works. The advisory lock serializes concurrent issuances for
// the same user, so racing requests cannot all observe the same
// pre-count and overshoot the cap together. Returns issued=false when
// the cap is already reached — no row is written in that case.
func (a *PasswordResetTokensAdapter) InsertIfUnderLimit(ctx context.Context, userID uuid.UUID, tokenHash, ipAddress string, expiresAt time.Time, window time.Duration, max int) (bool, error) {
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: %w", WrapPgError(err))
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after commit

	q := New(tx)
	if err := q.LockPasswordResetUser(ctx, userID.String()); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: lock: %w", WrapPgError(err))
	}
	count, err := q.CountRecentPasswordResetTokensForUser(ctx, CountRecentPasswordResetTokensForUserParams{
		UserID:  PgtypeUUID(userID),
		Column2: PgtypeInterval(window),
	})
	if err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: count: %w", WrapPgError(err))
	}
	if int(count) >= max {
		if err := tx.Commit(ctx); err != nil {
			return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: commit: %w", WrapPgError(err))
		}
		return false, nil
	}
	if err := q.InvalidateOutstandingPasswordResetTokens(ctx, PgtypeUUID(userID)); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: invalidate: %w", WrapPgError(err))
	}
	if _, err := q.InsertPasswordResetToken(ctx, InsertPasswordResetTokenParams{
		UserID:    PgtypeUUID(userID),
		TokenHash: tokenHash,
		IpAddress: ipAddress,
		ExpiresAt: PgtypeTimestamptz(expiresAt),
	}); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: insert: %w", WrapPgError(err))
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.InsertIfUnderLimit: commit: %w", WrapPgError(err))
	}
	return true, nil
}

func (a *PasswordResetTokensAdapter) GetByHash(ctx context.Context, tokenHash string) (passwordreset.Token, error) {
	row, err := New(a.pool).GetPasswordResetTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return passwordreset.Token{}, domain.ErrNotFound
		}
		return passwordreset.Token{}, fmt.Errorf("PasswordResetTokensAdapter.GetByHash: %w", WrapPgError(err))
	}
	return a.rowToToken(row), nil
}

// MarkUsed stamps used_at. Returns domain.ErrNotFound if the row was
// already consumed (race lost) — the service maps that to
// ErrInvalidResetToken. The (id, used_at IS NULL) guard is what
// makes the token single-use: a second concurrent consume affects
// zero rows and surfaces as ErrNotFound here.
func (a *PasswordResetTokensAdapter) MarkUsed(ctx context.Context, id uuid.UUID) error {
	affected, err := New(a.pool).MarkPasswordResetTokenUsed(ctx, PgtypeUUID(id))
	if err != nil {
		return fmt.Errorf("PasswordResetTokensAdapter.MarkUsed: %w", WrapPgError(err))
	}
	if affected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// RegisterIPAttempt records one recovery-request attempt for the IP
// (known or unknown email) and reports whether the caller is still
// under the per-IP cap. Runs in a transaction: advisory lock first,
// then count + conditional insert. The lock is a separate statement
// so the count takes a fresh READ COMMITTED snapshot after any lock
// wait — concurrent requests from the same IP serialize and cannot
// all observe the same pre-insert count. Prunes attempts older than
// 24h on the way out.
func (a *PasswordResetTokensAdapter) RegisterIPAttempt(ctx context.Context, ip string, window time.Duration, max int) (bool, error) {
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.RegisterIPAttempt: %w", WrapPgError(err))
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after commit

	q := New(tx)
	if err := q.LockPasswordResetAttemptIP(ctx, ip); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.RegisterIPAttempt: lock: %w", WrapPgError(err))
	}
	count, err := q.CountRecentPasswordResetAttemptsForIP(ctx, CountRecentPasswordResetAttemptsForIPParams{
		IpAddress: ip,
		Column2:   PgtypeInterval(window),
	})
	if err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.RegisterIPAttempt: count: %w", WrapPgError(err))
	}
	if int(count) < max {
		if _, err := q.InsertPasswordResetAttempt(ctx, ip); err != nil {
			return false, fmt.Errorf("PasswordResetTokensAdapter.RegisterIPAttempt: insert: %w", WrapPgError(err))
		}
	}
	if err := q.PrunePasswordResetAttempts(ctx); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.RegisterIPAttempt: prune: %w", WrapPgError(err))
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("PasswordResetTokensAdapter.RegisterIPAttempt: commit: %w", WrapPgError(err))
	}
	return int(count) < max, nil
}
