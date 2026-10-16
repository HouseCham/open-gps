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
// create (under the per-user cap), look up by hash, mark consumed.
// Split out from RateLimitCounter so the consume path (which never
// touches the rate-limit counters) can depend on just this slice.
type TokenStore interface {
	// InsertIfUnderLimit issues a fresh token if the user is under max
	// issuances within the lookback window, invalidating prior
	// outstanding tokens first so only the freshest link works.
	// Returns issued=false when the per-user cap is already reached —
	// nothing is persisted in that case. The count, invalidate and
	// insert run in one transaction behind a per-user lock, so
	// concurrent requests cannot overshoot the cap together.
	InsertIfUnderLimit(ctx context.Context, userID uuid.UUID, tokenHash, ipAddress string, expiresAt time.Time, window time.Duration, max int) (issued bool, err error)

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
}

// RateLimitCounter is the throttling half of password-reset persistence.
// Kept separate from TokenStore because a future adapter (e.g. Redis)
// might implement only this half.
type RateLimitCounter interface {
	// RegisterIPAttempt records one recovery-request attempt from ip,
	// for any email address (known or not), and reports whether the
	// caller is still under max attempts within the lookback window.
	// Counting attempts — not issued tokens — is what makes the cap
	// cover unknown-email probing too. Adapters must serialize
	// concurrent attempts for the same IP (e.g. advisory lock in a
	// transaction before the count) so the cap cannot be overshot.
	// Rows older than the window are pruned opportunistically.
	RegisterIPAttempt(ctx context.Context, ip string, window time.Duration, max int) (allowed bool, err error)
}
