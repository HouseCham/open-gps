-- Main users table. Local projection of better-auth users.
-- Users are created lazily from the Authula middleware when a valid JWT arrives.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       varchar(255) NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'user',
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  deleted_at  timestamptz NULL
);

-- Ensures that only 1 row can have role='super_admin'.
-- Combined with the trigger from 000009, this makes the super_admin unique,
-- immutable, and non-deletable.
CREATE UNIQUE INDEX idx_users_one_super_admin
  ON users (role) WHERE role = 'super_admin';

-- Hot path: lookup of active users by email (most queries filter deleted_at IS NULL).
CREATE INDEX idx_users_active_email
  ON users (email) WHERE deleted_at IS NULL;
