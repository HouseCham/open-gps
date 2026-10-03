# Indexes

## Partial Indexes

Most indexes use the `WHERE deleted_at IS NULL` pattern. Since application queries always filter out soft-deleted rows, partial indexes are smaller and faster than full-table indexes.

### idx_users_one_super_admin

```
UNIQUE INDEX ON users (role) WHERE role = 'super_admin';
```

- **Table**: users
- **Type**: Partial, unique
- **Purpose**: Enforces that at most one user can have the `super_admin` role
- **Migration**: 000003

### idx_users_active_email

```
INDEX ON users (email) WHERE deleted_at IS NULL;
```

- **Table**: users
- **Type**: Partial, B-tree
- **Purpose**: Accelerates email lookups during login and AuthSession user materialisation. Most queries filter `deleted_at IS NULL`.
- **Migration**: 000003

### idx_devices_active_uuid

```
INDEX ON devices (uuid_firmware) WHERE deleted_at IS NULL;
```

- **Table**: devices
- **Type**: Partial, B-tree
- **Purpose**: Accelerates device auth lookup by `uuid_firmware` on every IoT request. Hot path.
- **Migration**: 000004

### idx_user_device_access_active_user

```
INDEX ON user_device_access (user_id) WHERE deleted_at IS NULL;
```

- **Table**: user_device_access
- **Type**: Partial, B-tree
- **Purpose**: Accelerates the "list my devices" query by filtering active access grants for a user.
- **Migration**: 000005

### idx_device_api_keys_active_hash

```
UNIQUE INDEX ON device_api_keys (key_hash) WHERE deleted_at IS NULL;
```

- **Table**: device_api_keys
- **Type**: Partial, unique
- **Purpose**: Hot auth path — looks up a device API key by exact token match (the token is stored raw, not hashed; see [db.md](db.md)). Uniqueness only applies to active keys, allowing key rotation.
- **Migration**: 000008

### idx_device_api_keys_active_device

```
UNIQUE INDEX ON device_api_keys (device_id) WHERE deleted_at IS NULL;
```

- **Table**: device_api_keys
- **Type**: Partial, unique
- **Purpose**: Enforces at most one active API key per device at the DB level (also short-circuits the admin UI query that lists a device's active key).
- **Migration**: 000008 (initially non-unique), 000017 (made UNIQUE)

### idx_device_share_links_active_device

```
INDEX ON device_share_links (device_id, created_at DESC) WHERE revoked_at IS NULL;
```

- **Table**: device_share_links
- **Type**: Partial, B-tree
- **Purpose**: Lists active guest links for a device in creation order.
- **Migration**: 000022

### idx_password_reset_tokens_user_id

```
INDEX ON password_reset_tokens (user_id);
```

- **Table**: password_reset_tokens
- **Type**: B-tree
- **Purpose**: Supports the per-user rate-limit count query (rows for a given user within the last N minutes) without scanning the whole table.
- **Migration**: 000018

### idx_password_reset_tokens_ip_created

```
INDEX ON password_reset_tokens (ip_address, created_at DESC);
```

- **Table**: password_reset_tokens
- **Type**: Composite, B-tree
- **Purpose**: Per-IP rate-limit probe — rows for a given IP within the last 15 minutes.
- **Migration**: 000018

## Constraint-Backed Indexes

PostgreSQL backs these constraints with indexes of their own:

| Constraint | Table | Definition | Purpose | Migration |
|------------|-------|------------|---------|-----------|
| `password_reset_tokens_pkey` | password_reset_tokens | PRIMARY KEY `(id)` | Row lookup | 000018 |
| `password_reset_tokens_token_hash_key` | password_reset_tokens | UNIQUE `(token_hash)` | Reset-token lookup path (consume) | 000018 |
| `location_ingest_keys_pkey` | location_ingest_keys | PRIMARY KEY `(device_id, sequence_id)` | Batch idempotency — replayed sequence hits the PK | 000021 |
| `device_share_links_token_hash_key` | device_share_links | UNIQUE `(token_hash)` | Guest share-link lookup | 000022 |

## Full-Table Indexes

The `locations` table does not use partial indexes because it has no soft-delete column. Its primary key (`device_id`, `recorded_at`) serves as the main access path:

- **Lookup by device**: B-tree on PK `(device_id, recorded_at)` enables efficient range scans for a device's location history
- **Partition pruning**: The `recorded_at` portion of the PK enables PostgreSQL to skip irrelevant monthly partitions when querying with time-range filters

## Summary

| Index | Table | Type | Partial | Hot Path |
|-------|-------|------|---------|----------|
| idx_users_one_super_admin | users | Unique | Yes | super_admin enforcement |
| idx_users_active_email | users | B-tree | Yes | Auth login/lookup |
| idx_devices_active_uuid | devices | B-tree | Yes | IoT device auth |
| idx_user_device_access_active_user | user_device_access | B-tree | Yes | User device listing |
| idx_device_api_keys_active_hash | device_api_keys | Unique | Yes | IoT key auth |
| idx_device_api_keys_active_device | device_api_keys | Unique | Yes | One-active-key enforcement |
| idx_device_share_links_active_device | device_share_links | B-tree | Yes | Active guest-link listing |
| idx_password_reset_tokens_user_id | password_reset_tokens | B-tree | No | Per-user reset rate limit |
| idx_password_reset_tokens_ip_created | password_reset_tokens | Composite | No | Per-IP reset rate limit |
| location_ingest_keys_pkey | location_ingest_keys | Primary | No | Batch idempotency |
| locations_pkey | locations | Primary | No | Location queries |
