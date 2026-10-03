ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NULL;

UPDATE devices
SET last_seen_at = COALESCE(last_seen_at, last_contact_at)
WHERE last_contact_at IS NOT NULL;

ALTER TABLE devices
  DROP COLUMN IF EXISTS last_contact_at;
