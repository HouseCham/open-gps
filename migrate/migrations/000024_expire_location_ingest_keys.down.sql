-- Removes the prune job and its supporting index.
SELECT cron.unschedule('prune-location-ingest-keys');
DROP INDEX location_ingest_keys_created_at_idx;
