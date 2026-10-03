-- Time-series table: GPS locations reported by devices.
-- APPEND-ONLY: no soft delete. Old data is purged via DROP TABLE of partitions.
-- Partitioned by RANGE(recorded_at) -- monthly partitions (configured in 000007).

CREATE TABLE locations (
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  altitude    double precision NULL,
  speed       double precision NULL,
  accuracy    double precision NULL,
  satellites  integer NULL,
  PRIMARY KEY (device_id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Note: the composite PK includes recorded_at (partitioned table requirement:
-- every PK must include the partition key). This also enables
-- ON CONFLICT (device_id, recorded_at) DO NOTHING for idempotency on ESP32 retries.
