-- Remove redundant satellites column from locations.
-- 'accuracy' already captures GPS fix quality in meters; satellite count is
-- redundant. Decision: decision-gps-tracker-payload-esquema (2026-07-07).

ALTER TABLE locations DROP COLUMN IF EXISTS satellites;
