-- Every password-recovery request records an attempt row keyed by
-- request IP, regardless of whether the email address exists. The
-- per-IP rate limit counts these rows (instead of issued token rows),
-- so unknown-email probing consumes the same budget as real requests.
--
-- Rows are pruned opportunistically by the register query itself
-- (anything older than 24h — well past the 15-minute count window —
-- is deleted when the same statement runs), so the table stays
-- bounded without a scheduler.
CREATE TABLE password_reset_attempts (
  id         bigserial PRIMARY KEY,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Per-IP count probe: rows for a given IP within the last N minutes.
CREATE INDEX idx_password_reset_attempts_ip_created
  ON password_reset_attempts (ip_address, created_at DESC);

-- Opportunistic prune path used by the register statement.
CREATE INDEX idx_password_reset_attempts_created
  ON password_reset_attempts (created_at);
