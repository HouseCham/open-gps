-- BA-08: bound the batch-idempotency horizon. Firmware retries are
-- minutes-to-hours, not months, so location_ingest_keys rows older than
-- the retry window can never be needed again. A daily prune (after the
-- 03:00 partman maintenance window) keeps the table and its PK index
-- proportional to recent traffic instead of growing forever.
--
-- Retention matches the documented 30-day idempotency contract in
-- docs/api/Locations.md. The prune also keeps the firmware guidance
-- honest: a sequence_id reused more than 30 days later is treated as a
-- fresh insert (the locations PK still deduplicates by recorded_at).

-- Supports the prune's WHERE created_at < ... predicate.
CREATE INDEX location_ingest_keys_created_at_idx ON location_ingest_keys (created_at);

SELECT cron.schedule(
  'prune-location-ingest-keys',
  '30 3 * * *',
  $$DELETE FROM location_ingest_keys WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'$$
);
