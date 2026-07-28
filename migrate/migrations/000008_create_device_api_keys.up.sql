-- Hashed API keys (bcrypt) for IoT device authentication.
-- The ESP32 sends the key in X-Device-Key; backend hashes, looks up by hash, validates.
-- Soft delete + new keys = rotation without downtime.

CREATE TABLE device_api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  key_hash      varchar(255) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  expires_at    timestamptz NULL,
  last_used_at  timestamptz NULL,
  deleted_at    timestamptz NULL
);

-- Hot auth path: lookup by hash on every device request.
-- UNIQUE only on active keys (soft-deleted do not occupy the constraint).
CREATE UNIQUE INDEX idx_device_api_keys_active_hash
  ON device_api_keys (key_hash) WHERE deleted_at IS NULL;

-- List the keys of a device (for the admin UI).
CREATE INDEX idx_device_api_keys_active_device
  ON device_api_keys (device_id) WHERE deleted_at IS NULL;
