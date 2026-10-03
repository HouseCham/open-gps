-- One-time-use password reset tokens.
--
-- The application sends the raw token only by email (in the reset URL).
-- The DB stores the sha256 of the raw token, so a DB leak does not yield
-- working reset links. The unique index on token_hash is the lookup path
-- used by Consume.
--
-- ON DELETE CASCADE on user_id means a soft-deleted user purges their
-- outstanding tokens; a hard delete is irrelevant (the table is the only
-- thing referring to it, and tokens are short-lived).
--
-- Index on user_id supports the rate-limit count query
-- (rows for a given user within the last N minutes) without scanning
-- the whole table.
CREATE TABLE password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  ip_address  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_id
  ON password_reset_tokens (user_id);

-- Per-IP rate-limit probe: rows for a given IP within the last
-- 15 minutes. Created_at is already on the table; the index lets the
-- probe stay cheap without scanning the whole token history.
CREATE INDEX idx_password_reset_tokens_ip_created
  ON password_reset_tokens (ip_address, created_at DESC);
