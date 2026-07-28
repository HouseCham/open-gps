-- Enforce "at most one active API key per device" at the DB level.
-- Today the application code (apikeys.Service.Create) keeps this invariant
-- by pre-checking + rotating prior keys; the new partial UNIQUE index
-- protects it from future drift and from concurrent-create races (a
-- second concurrent insert hits SQLSTATE 23505 and WrapPgError maps it
-- to domain.ErrConflict → 409).
--
-- Assumption: no device currently has more than one active (deleted_at IS
-- NULL) key. If this assumption is violated the index build fails and a
-- human must reconcile by hand — at which point the prior rotation logic
-- was already broken.

DROP INDEX IF EXISTS idx_device_api_keys_active_device;

CREATE UNIQUE INDEX idx_device_api_keys_active_device
  ON device_api_keys (device_id) WHERE deleted_at IS NULL;