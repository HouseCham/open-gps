-- name: CreateDeviceShareLink :one
INSERT INTO device_share_links (device_id, created_by, token_hash, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, device_id, created_by, token_hash, created_at, expires_at, revoked_at;

-- name: ListActiveDeviceShareLinks :many
SELECT id, device_id, created_by, token_hash, created_at, expires_at, revoked_at
FROM device_share_links
WHERE device_id = $1
  AND revoked_at IS NULL
  AND expires_at > NOW()
ORDER BY created_at DESC;

-- name: RevokeDeviceShareLink :exec
UPDATE device_share_links
SET revoked_at = NOW()
WHERE id = $1
  AND device_id = $2
  AND revoked_at IS NULL;

-- name: GetValidDeviceShareLinkByHash :one
SELECT dsl.id, dsl.device_id, dsl.created_by, dsl.token_hash,
       dsl.created_at, dsl.expires_at, dsl.revoked_at, d.name AS device_name
FROM device_share_links AS dsl
JOIN devices AS d ON d.id = dsl.device_id AND d.deleted_at IS NULL
WHERE dsl.token_hash = $1
  AND dsl.revoked_at IS NULL
  AND dsl.expires_at > NOW();
