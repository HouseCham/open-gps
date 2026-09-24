-- Global idempotency keys for device batch ingestion. This table is not
-- partitioned, so uniqueness is enforced across all location partitions.
CREATE TABLE location_ingest_keys (
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  sequence_id bigint NOT NULL,
  recorded_at timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (device_id, sequence_id)
);

ALTER TABLE location_ingest_keys
  ADD CONSTRAINT location_ingest_keys_sequence_positive CHECK (sequence_id > 0);
