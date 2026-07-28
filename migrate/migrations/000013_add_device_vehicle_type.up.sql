-- Vehicle type for the asset the GPS is mounted on. The UI uses this value
-- to render the right icon next to the device (icon mapping lives in the
-- frontend; the backend only stores the category).
--
-- Existing rows get 'other' from the column DEFAULT, so the migration is
-- safe to run with no backfill.

CREATE TYPE device_vehicle_type AS ENUM (
  'bicycle',
  'motorcycle',
  'car',
  'truck',
  'van',
  'other'
);

ALTER TABLE devices
  ADD COLUMN vehicle_type device_vehicle_type NOT NULL DEFAULT 'other';