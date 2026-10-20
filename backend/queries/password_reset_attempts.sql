-- name: LockPasswordResetAttemptIP :exec
-- Transaction-scoped advisory lock keyed on hashtext of the IP.
-- Held before the count/insert so concurrent requests from the same
-- IP serialize. It MUST be its own statement: at READ COMMITTED each
-- statement takes a fresh snapshot, so the count that runs after the
-- lock sees any concurrent insert that committed while this
-- transaction waited. A lock in the same statement as the count would
-- still see the pre-lock snapshot and could overshoot the cap.
SELECT pg_advisory_xact_lock(hashtext($1)::bigint);

-- name: CountRecentPasswordResetAttemptsForIP :one
-- Pre-insert window count for one IP. Run after LockPasswordResetAttemptIP
-- in the same transaction so concurrent requests cannot all observe the
-- same count. The caller decides allowed = count < max.
SELECT COUNT(*)::bigint AS count
FROM password_reset_attempts
WHERE ip_address = $1
  AND created_at > NOW() - $2::interval;

-- name: InsertPasswordResetAttempt :execrows
-- Records one recovery-request attempt. Called only while under the cap
-- (decided by the caller from CountRecentPasswordResetAttemptsForIP).
-- Rows are counted regardless of email validity, so unknown-email
-- probing consumes the same per-IP budget.
INSERT INTO password_reset_attempts (ip_address)
VALUES ($1);

-- name: PrunePasswordResetAttempts :exec
-- Opportunistic cleanup, run on every register: anything older than
-- 24h is well past the 15-minute count window and useless. Keeps the
-- table bounded without a scheduler.
DELETE FROM password_reset_attempts
WHERE created_at < NOW() - INTERVAL '24 hours';
