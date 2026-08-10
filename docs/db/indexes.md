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
- **Purpose**: Accelerates email lookups during login/lazy-user middleware. Most queries filter `deleted_at IS NULL`.
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
- **Purpose**: Hot auth path — looks up device API key by bcrypt hash. Uniqueness only applies to active keys, allowing key rotation.
- **Migration**: 000008

### idx_device_api_keys_active_device

```
INDEX ON device_api_keys (device_id) WHERE deleted_at IS NULL;
```

- **Table**: device_api_keys
- **Type**: Partial, B-tree
- **Purpose**: Accelerates the admin UI query that lists all active keys for a device.
- **Migration**: 000008

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
| idx_device_api_keys_active_device | device_api_keys | B-tree | Yes | Key listing |
| locations_pkey | locations | Primary | No | Location queries |
