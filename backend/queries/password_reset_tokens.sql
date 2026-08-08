-- name: InsertPasswordResetToken :one
-- Stores a new password-reset token. The caller is responsible for
-- hashing the raw token (sha256) before passing token_hash in.
-- ON CONFLICT DO NOTHING would not work because token_hash has a UNIQUE
-- index — a collision is a security failure, not a normal outcome. The
-- caller picks 32 bytes from crypto/rand, so collisions are not a concern.
INSERT INTO password_reset_tokens (user_id, token_hash, ip_address, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, user_id, token_hash, ip_address, expires_at, used_at, created_at;

-- name: GetPasswordResetTokenByHash :one
-- Lookup used by the consume endpoint. Filters out used tokens and
-- expired ones — if any condition fails, the row simply isn't returned
-- and the caller surfaces ErrInvalidResetToken. Keeping them in one
-- SELECT means the consume path is one round-trip.
SELECT id, user_id, token_hash, ip_address, expires_at, used_at, created_at
FROM password_reset_tokens
WHERE token_hash = $1
  AND used_at IS NULL
  AND expires_at > NOW();

-- name: MarkPasswordResetTokenUsed :execrows
-- Stamps used_at on a successful consume. The (id, used_at IS NULL)
-- guard makes the operation idempotent: a second concurrent consume of
-- the same token affects 0 rows and the caller surfaces
-- ErrInvalidResetToken. This is how we make the token genuinely
-- single-use even under a race.
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE id = $1
  AND used_at IS NULL;

-- name: CountRecentPasswordResetTokensForUser :one
-- Rate-limit probe for "too many requests for this user". Counts every
-- token issued for the user in the last 15 minutes, regardless of
-- whether it's still outstanding — the limit is on dispatch, not on
-- success.
SELECT COUNT(*)::bigint AS count
FROM password_reset_tokens
WHERE user_id = $1
  AND created_at > NOW() - $2::interval;

-- name: CountRecentPasswordResetTokensForIP :one
-- Per-IP sibling of CountRecentPasswordResetTokensForUser. Counts every
-- token issued from the same IP within the lookback window.
SELECT COUNT(*)::bigint AS count
FROM password_reset_tokens
WHERE ip_address = $1
  AND created_at > NOW() - $2::interval;

-- name: InvalidateOutstandingPasswordResetTokens :exec
-- On a fresh request, mark every still-outstanding (not used, not
-- expired) token for the user as used so only the latest link works.
-- Single-window invariant: at most one active link per user.
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE user_id = $1
  AND used_at IS NULL
  AND expires_at > NOW();
