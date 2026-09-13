-- name: GetDeviceByID :one
-- Standard lookup by primary key. Filters out soft-deleted devices.
SELECT id, uuid_firmware, name, vehicle_type, created_at, last_contact_at, deleted_at
FROM devices
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetDeviceByIDForUser :one
-- Returns the device only if the given user has access (any role).
-- Returns sql.ErrNoRows when the device does not exist OR the user has no
-- access. The handler maps both to 404 to avoid leaking which IDs exist.
SELECT
  d.id,
  d.uuid_firmware,
  d.name,
  d.vehicle_type,
  d.created_at,
  d.last_contact_at,
  uda.role AS access_role
FROM devices d
INNER JOIN user_device_access uda
  ON d.id = uda.device_id AND uda.deleted_at IS NULL
WHERE d.id = $1
  AND uda.user_id = $2
  AND d.deleted_at IS NULL;

-- name: GetDeviceByUUIDFirmware :one
-- Hot auth path for the IoT device authentication flow.
-- The ESP32 sends its uuid_firmware, the backend resolves it to a device row.
SELECT id, uuid_firmware, name, vehicle_type, created_at, last_contact_at, deleted_at
FROM devices
WHERE uuid_firmware = $1 AND deleted_at IS NULL;

-- name: GetDeviceIDByUuidFirmware :one
-- Lightweight lookup that only returns the device id. Used by the IoT
-- location-ingest middleware after the API key has authenticated the
-- caller: we know the key's device_id, but we still want to confirm
-- the path's uuid_firmware maps to the same device row before we accept
-- the payload. Returns sql.ErrNoRows when the device does not exist OR
-- is soft-deleted; the middleware maps both to 404.
SELECT id FROM devices WHERE uuid_firmware = $1 AND deleted_at IS NULL;

-- name: ListDevicesForUser :many
-- Returns the devices the given user has access to, with the access role
-- from user_device_access. Used by the dashboard "my devices" view.
-- Filters out soft-deleted devices and soft-deleted access grants.
SELECT
  d.id,
  d.uuid_firmware,
  d.name,
  d.vehicle_type,
  d.created_at,
  d.last_contact_at,
  uda.role AS access_role
FROM devices d
INNER JOIN user_device_access uda
  ON d.id = uda.device_id AND uda.deleted_at IS NULL
WHERE uda.user_id = $1
  AND d.deleted_at IS NULL
ORDER BY d.created_at DESC;

-- name: CreateDevice :one
-- Creates a new device. uuid_firmware must be globally unique (DB-enforced).
INSERT INTO devices (uuid_firmware, name, vehicle_type)
VALUES (
  sqlc.arg('uuid_firmware'),
  sqlc.arg('name'),
  sqlc.arg('vehicle_type')::device_vehicle_type
)
RETURNING id, uuid_firmware, name, vehicle_type, created_at, last_contact_at, deleted_at;

-- name: UpdateDeviceName :one
-- Updates the display name. Returns the updated row, or sql.ErrNoRows
-- if the device does not exist or is soft-deleted.
UPDATE devices
SET name = $2
WHERE id = $1 AND deleted_at IS NULL
RETURNING id, uuid_firmware, name, vehicle_type, created_at, last_contact_at, deleted_at;

-- name: UpdateDeviceVehicleType :one
-- Updates the vehicle type. Returns the updated row, or sql.ErrNoRows
-- if the device does not exist or is soft-deleted.
UPDATE devices
SET vehicle_type = sqlc.arg('vehicle_type')::device_vehicle_type
WHERE id = sqlc.arg('id') AND deleted_at IS NULL
RETURNING id, uuid_firmware, name, vehicle_type, created_at, last_contact_at, deleted_at;

-- name: UpdateDeviceLastSeen :exec
-- Called by the device auth middleware on every successful request
-- from the IoT device. Cheap, no RETURNING.
UPDATE devices
SET last_contact_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: SoftDeleteDevice :exec
-- Marks the device as deleted. CASCADE-safe: locations and api_keys
-- are not touched (RESTRICT FKs).
UPDATE devices
SET deleted_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListDevicesForUserPaginated :many
-- Returns paginated devices for a user with access.
-- Used by the user profile endpoint to list user's devices.
SELECT d.id, d.uuid_firmware, d.name, d.vehicle_type, d.created_at, d.last_contact_at
FROM devices d
INNER JOIN user_device_access uda
  ON d.id = uda.device_id AND uda.deleted_at IS NULL
WHERE uda.user_id = $1
  AND d.deleted_at IS NULL
ORDER BY d.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountDevicesForUser :one
-- Returns the total count of devices a user has access to.
-- Used for pagination metadata.
SELECT COUNT(*)::bigint AS count
FROM devices d
INNER JOIN user_device_access uda
  ON d.id = uda.device_id AND uda.deleted_at IS NULL
WHERE uda.user_id = $1
  AND d.deleted_at IS NULL;

-- name: ListDevicesForUserWithAccessPaginated :many
-- Returns paginated devices the given user has access to, with the access role.
-- Used by the device list endpoint with pagination.
SELECT
  d.id,
  d.uuid_firmware,
  d.name,
  d.vehicle_type,
  d.created_at,
  d.last_contact_at,
  uda.role AS access_role
FROM devices d
INNER JOIN user_device_access uda
  ON d.id = uda.device_id AND uda.deleted_at IS NULL
WHERE uda.user_id = $1
  AND d.deleted_at IS NULL
ORDER BY d.created_at DESC
LIMIT $2 OFFSET $3;