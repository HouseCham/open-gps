-- name: InsertLocation :exec
-- Idempotent insert for IoT location reports.
-- ON CONFLICT (device_id, recorded_at) DO NOTHING handles ESP32 retries
-- (same device + same timestamp) without raising an error or duplicating rows.
-- This relies on the composite PK (device_id, recorded_at) from migration 000006.
INSERT INTO locations (
  device_id, recorded_at, latitude, longitude,
  altitude, speed, accuracy, battery_voltage, signal_strength
) VALUES (
  $1, $2, $3, $4,
  $5, $6, $7, $8, $9
)
ON CONFLICT (device_id, recorded_at) DO NOTHING;

-- name: GetLocationsForDevice :many
-- Returns the location history for a single device in a time range.
-- Partition pruning: the WHERE on recorded_at lets Postgres skip partitions
-- that fall outside the [$2, $3) range. Critical for performance as data grows.
-- $2 is the inclusive lower bound, $3 is the exclusive upper bound.
SELECT device_id, recorded_at, latitude, longitude,
       altitude, speed, accuracy, battery_voltage, signal_strength
FROM locations
WHERE device_id = $1
  AND recorded_at >= $2
  AND recorded_at < $3
ORDER BY recorded_at DESC
LIMIT $4 OFFSET $5;

-- name: CountLocationsForDevice :one
-- Returns the number of location rows in a device's time range.
SELECT COUNT(*)::bigint AS count
FROM locations
WHERE device_id = $1
  AND recorded_at >= $2
  AND recorded_at < $3;

-- name: GetLatestLocationForDevice :one
-- Returns the most recent location for a device. Used by the live map view.
-- Hits the most recent partition first via partition pruning.
SELECT device_id, recorded_at, latitude, longitude,
       altitude, speed, accuracy, battery_voltage, signal_strength
FROM locations
WHERE device_id = $1
ORDER BY recorded_at DESC
LIMIT 1;

-- name: GetRouteForDevice :many
-- Returns a chronological, bounded route for a device in a time range.
-- Sampling keeps large detective-mode windows small enough for the map while
-- preserving the first and last point and the temporal order of the path.
WITH ranked AS (
  SELECT l.device_id, l.recorded_at, l.latitude, l.longitude,
         l.altitude, l.speed, l.accuracy, l.battery_voltage, l.signal_strength,
         NTILE($4) OVER (ORDER BY l.recorded_at ASC) AS bucket
  FROM locations l
  WHERE l.device_id = $1
    AND l.recorded_at >= $2
    AND l.recorded_at < $3
), sampled AS (
  SELECT DISTINCT ON (bucket)
         device_id, recorded_at, latitude, longitude,
         altitude, speed, accuracy, battery_voltage, signal_strength
  FROM ranked
  ORDER BY bucket, recorded_at ASC
), last_point AS (
  SELECT l.device_id, l.recorded_at, l.latitude, l.longitude,
         l.altitude, l.speed, l.accuracy, l.battery_voltage, l.signal_strength
  FROM locations l
  WHERE l.device_id = $1
    AND l.recorded_at >= $2
    AND l.recorded_at < $3
  ORDER BY l.recorded_at DESC
  LIMIT 1
)
SELECT route.device_id, route.recorded_at, route.latitude, route.longitude,
       route.altitude, route.speed, route.accuracy, route.battery_voltage, route.signal_strength
FROM (
  SELECT * FROM sampled
  UNION
  SELECT * FROM last_point
) route
ORDER BY route.recorded_at ASC;

-- name: GetLocationsForUser :many
-- Returns all locations for all devices a user has access to, in a time range.
-- Used for the multi-device dashboard view. Joins through user_device_access
-- to filter by the user's authorized devices.
SELECT
  l.device_id,
  l.recorded_at,
  l.latitude,
  l.longitude,
  l.altitude,
  l.speed,
  l.accuracy,
  l.battery_voltage,
  l.signal_strength
FROM locations l
INNER JOIN user_device_access uda
  ON l.device_id = uda.device_id AND uda.deleted_at IS NULL
WHERE uda.user_id = $1
  AND l.recorded_at >= $2
  AND l.recorded_at < $3
ORDER BY l.recorded_at DESC;
