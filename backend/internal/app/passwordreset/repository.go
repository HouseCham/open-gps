package passwordreset

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Token is the persistence-layer view of a password-reset token.
// Exposed to the service so the consume path can decide which token
// to mark used (it already knows the id from the lookup).
type Token struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	IPAddress string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

// TokenStore is the token-lifecycle half of password-reset persistence:
// create, look up by hash, mark consumed, and invalidate prior
// outstanding tokens when a fresh one is issued. Split out from
// RateLimitCounter so the consume path (which never touches the rate
// counters) can depend on just this slice.
type TokenStore interface {
	// Insert persists a new token row. The hash is what the DB stores;
	// the raw token is only known to the caller (it ends up in the
	// email). ipAddress is the request IP the caller observed, used
	// for the per-IP rate-limit cap; empty string disables the IP
	// column (the application-layer count is still honored).
	// expiresAt is the absolute cutoff.
	Insert(ctx context.Context, userID uuid.UUID, tokenHash, ipAddress string, expiresAt time.Time) (Token, error)

	// GetByHash returns the token if it exists, is unused, and has not
	// expired. Returns ErrNotFound otherwise — the service treats all
	// three failure modes as ErrInvalidResetToken and never discloses
	// which one fired.
	GetByHash(ctx context.Context, tokenHash string) (Token, error)

	// MarkUsed stamps used_at on a token. The caller has already
	// verified it via GetByHash; this is the single-use guarantee.
	// Returns ErrNotFound if the row was already used (race between
	// two concurrent consumes) — service maps that to ErrInvalidResetToken.
	MarkUsed(ctx context.Context, id uuid.UUID) error

	// InvalidateOutstanding marks every still-outstanding (unused,
	// unexpired) token for the user as used. Called before inserting a
	// new one, so only the freshest link works.
	InvalidateOutstanding(ctx context.Context, userID uuid.UUID) error
}

// RateLimitCounter is the throttling half of password-reset persistence.
// Kept separate from TokenStore because the two reads need different
// indexes (ip hash for CountRecentForIP, user FK for CountRecentForUser),
// and a future adapter (e.g. Redis) might implement only this half.
type RateLimitCounter interface {
	// CountRecentForUser returns how many tokens were issued for the
	// given user within the lookback window. Used by the rate limiter.
	CountRecentForUser(ctx context.Context, userID uuid.UUID, lookback time.Duration) (int, error)

	// CountRecentForIP is the per-IP sibling of CountRecentForUser.
	// Implemented by the postgres adapter via a dedicated column on
	// the tokens table — kept separate because it needs different
	// indexing (hash on ip, range scan on created_at) and we don't
	// want to bind the two rate limits together at the schema level.
	CountRecentForIP(ctx context.Context, ip string, lookback time.Duration) (int, error)
}
