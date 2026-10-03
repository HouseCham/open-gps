-- Pivot table: which users have access to which devices and with which role.
-- Roles: owner (CRUD), editor (update + read), viewer (read only).
-- Composite PK: (user_id, device_id) -- a user has only one role per device.

CREATE TABLE user_device_access (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  role        varchar(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  deleted_at  timestamptz NULL,
  PRIMARY KEY (user_id, device_id)
);

-- Hot path: "list my devices" query filters by user_id and deleted_at IS NULL.
CREATE INDEX idx_user_device_access_active_user
  ON user_device_access (user_id) WHERE deleted_at IS NULL;
