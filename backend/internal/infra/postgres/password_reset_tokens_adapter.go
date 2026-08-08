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
// passwordreset.RateLimitCounter
// against the password_reset_tokens table. One row per token; the
// sha256 hash is what the DB stores, the raw token only exists in
// the email.
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

func (a *PasswordResetTokensAdapter) Insert(ctx context.Context, userID uuid.UUID, tokenHash, ipAddress string, expiresAt time.Time) (passwordreset.Token, error) {
	row, err := New(a.pool).InsertPasswordResetToken(ctx, InsertPasswordResetTokenParams{
		UserID:    PgtypeUUID(userID),
		TokenHash: tokenHash,
		IpAddress: ipAddress,
		ExpiresAt: PgtypeTimestamptz(expiresAt),
	})
	if err != nil {
		return passwordreset.Token{}, fmt.Errorf("PasswordResetTokensAdapter.Insert: %w", WrapPgError(err))
	}
	return a.rowToToken(row), nil
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

func (a *PasswordResetTokensAdapter) CountRecentForUser(ctx context.Context, userID uuid.UUID, lookback time.Duration) (int, error) {
	row, err := New(a.pool).CountRecentPasswordResetTokensForUser(ctx, CountRecentPasswordResetTokensForUserParams{
		UserID:   PgtypeUUID(userID),
		Column2:  PgtypeInterval(lookback),
	})
	if err != nil {
		return 0, fmt.Errorf("PasswordResetTokensAdapter.CountRecentForUser: %w", WrapPgError(err))
	}
	return int(row), nil
}

func (a *PasswordResetTokensAdapter) CountRecentForIP(ctx context.Context, ip string, lookback time.Duration) (int, error) {
	row, err := New(a.pool).CountRecentPasswordResetTokensForIP(ctx, CountRecentPasswordResetTokensForIPParams{
		IpAddress: ip,
		Column2:   PgtypeInterval(lookback),
	})
	if err != nil {
		return 0, fmt.Errorf("PasswordResetTokensAdapter.CountRecentForIP: %w", WrapPgError(err))
	}
	return int(row), nil
}

func (a *PasswordResetTokensAdapter) InvalidateOutstanding(ctx context.Context, userID uuid.UUID) error {
	if err := New(a.pool).InvalidateOutstandingPasswordResetTokens(ctx, PgtypeUUID(userID)); err != nil {
		return fmt.Errorf("PasswordResetTokensAdapter.InvalidateOutstanding: %w", WrapPgError(err))
	}
	return nil
}
