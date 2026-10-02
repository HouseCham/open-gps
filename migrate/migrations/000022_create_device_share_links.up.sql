CREATE TABLE device_share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  created_by  uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash  varchar(64) NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);

CREATE INDEX idx_device_share_links_active_device
  ON device_share_links (device_id, created_at DESC)
  WHERE revoked_at IS NULL;
