-- Presence is derived from the latest authenticated device contact.
-- Preserve existing values before removing the legacy column.
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz NULL;

UPDATE devices
SET last_contact_at = COALESCE(last_contact_at, last_seen_at)
WHERE last_seen_at IS NOT NULL;

ALTER TABLE devices
  DROP COLUMN IF EXISTS last_seen_at;
