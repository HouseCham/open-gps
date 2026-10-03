# Database Overview

PostgreSQL database for the GPS Tracker API. Managed via [golang-migrate](https://github.com/golang-migrate/migrate) with 22 migration files.

## Entity Relationship

```
┌──────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│        users         │     │  user_device_access  │     │     devices     │
│──────────────────────│     │──────────────────────│     │─────────────────│
│ id (PK)              │◄────┤ user_id (PK, FK)     │     │ id (PK)         │
│ email                │     │ device_id (PK, FK)   ├─────│ uuid_firmware   │
│ name                 │     │ role                 │     │ name            │
│ lastname             │     │ created_at           │     │ vehicle_type    │
│ role (enum)          │     │ deleted_at           │     │ created_at      │
│ email_verified       │     │                      │     │ last_contact_at │
│ image                │     │                      │     │ deleted_at      │
│ must_change_password │     │                      │     │                 │
│ created_at           │     │                      │     │                 │
│ updated_at           │     │                      │     │                 │
│ deleted_at           │     │                      │     │                 │
└───────────┬──────────┘     └──────────────────────┘     └────────┬────────┘
            │                                                      │
            │                            ┌─────────────────────────┴─────────────────┐
┌───────────▼───────────┐  ┌─────────────▼─────────────┐                ┌────────────▼────────────┐
│ password_reset_tokens │  │         locations         │                │     device_api_keys     │
│───────────────────────│  │───────────────────────────│                │─────────────────────────│
│ user_id (FK, CASCADE) │  │ device_id (PK, FK)        │                │ id (PK)                 │
│ token_hash (UNIQUE)   │  │ recorded_at (PK, part.)   │                │ device_id (FK)          │
│ ip_address            │  │ latitude / longitude      │                │ key_hash                │
│ expires_at            │  │ altitude / speed          │                │ created_at              │
│ used_at               │  │ accuracy                  │                │ expires_at              │
│ created_at            │  │ battery_voltage           │                │ last_used_at            │
│                       │  │ signal_strength           │                │ deleted_at              │
└───────────────────────┘  └───────────────────────────┘                └─────────────────────────┘
```

Tables not shown in the diagram: `device_share_links` (guest share links, see Tables below) and `location_ingest_keys` (batch idempotency, FK → devices RESTRICT).

## Tables

### users

Local projection of Authula-authenticated users. Created lazily on the first authenticated request — the `AuthSession` middleware materialises the row from the session cookie.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | `uuid` | `PK DEFAULT gen_random_uuid()` | User identifier |
| email | `varchar(255)` | `NOT NULL UNIQUE` | User email address |
| email_verified | `boolean` | `NOT NULL DEFAULT FALSE` | Authula email-verification flag |
| image | `text` | `NULL` | Avatar URL from Authula |
| name | `varchar(255)` | `NOT NULL DEFAULT ''` | User first name |
| lastname | `varchar(100)` | `NOT NULL DEFAULT ''` | User last name |
| role | `user_role` | `NOT NULL DEFAULT 'user'` | Global role: `user` or `super_admin` |
| must_change_password | `boolean` | `NOT NULL DEFAULT TRUE` | Blocks API until a temp password is changed |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Row creation timestamp |
| updated_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Row last update timestamp |
| deleted_at | `timestamptz` | `NULL` | Soft-delete timestamp |

Constraints:
- Only one row can have `role = 'super_admin'` (partial unique index)
- `super_admin` role cannot be changed or deleted (PL/pgSQL triggers)
- All users can soft-delete their own account except `super_admin`
- Email uniqueness enforced with `UNIQUE` constraint

### devices

IoT devices registered in the system. Each device has a firmware-level UUID (`uuid_firmware`) generated on the ESP32.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | `uuid` | `PK DEFAULT gen_random_uuid()` | Device identifier |
| uuid_firmware | `varchar(36)` | `NOT NULL UNIQUE` | ESP32 firmware UUID (public) |
| name | `varchar(255)` | `NOT NULL` | Human-readable device name |
| vehicle_type | `device_vehicle_type` | `NOT NULL DEFAULT 'other'` | Vehicle category: `bicycle`, `motorcycle`, `car`, `truck`, `van`, `other` |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Row creation timestamp |
| last_contact_at | `timestamptz` | `NULL` | Last successful IoT ping |
| deleted_at | `timestamptz` | `NULL` | Soft-delete timestamp |

### user_device_access

Pivot table mapping users to devices with role-based access. Composite PK ensures one role per (user, device) pair.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| user_id | `uuid` | `PK, FK → users(id) ON DELETE RESTRICT` | User identifier |
| device_id | `uuid` | `PK, FK → devices(id) ON DELETE RESTRICT` | Device identifier |
| role | `varchar(20)` | `NOT NULL CHECK (role IN ('owner','editor','viewer'))` | Access role |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Grant creation timestamp |
| deleted_at | `timestamptz` | `NULL` | Soft-delete (revocation) timestamp |

Roles:
- `owner` — Full CRUD + access management
- `editor` — Read + update device properties
- `viewer` — Read-only (location data)

### locations

Time-series GPS data. **Append-only** — partitioned by `RANGE(recorded_at)` with monthly partitions managed by pg_partman. Retention: 12 months.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| device_id | `uuid` | `PK, FK → devices(id) ON DELETE RESTRICT` | Device identifier |
| recorded_at | `timestamptz` | `PK` | GPS fix timestamp (partition key) |
| latitude | `double precision` | `NOT NULL` | WGS84 latitude (decimal degrees) |
| longitude | `double precision` | `NOT NULL` | WGS84 longitude (decimal degrees) |
| altitude | `double precision` | `NULL` | Altitude above sea level (meters) |
| speed | `double precision` | `NULL` | Ground speed (m/s) |
| accuracy | `double precision` | `NULL` | Position accuracy (meters) |
| battery_voltage | `double precision` | `NULL` | Reported battery voltage (volts) |
| signal_strength | `integer` | `NULL` | Cellular RSSI from AT+CSQ (`0`–`31`) |

Design decisions:
- Composite PK `(device_id, recorded_at)` satisfies the partitioned table requirement that every PK includes the partition key
- `ON CONFLICT (device_id, recorded_at) DO NOTHING` on insert handles ESP32 retry logic idempotently
- Old partitions are dropped (not deleted row-by-row) for instant retention cleanup
- `satellites` was removed (migrations 14) because `accuracy` already encodes the information actionably. `battery_voltage` and `signal_strength` were added for device-health telemetry (migrations 15–16).

### device_api_keys

Opaque lookup tokens for IoT device authentication. The device sends the token in the `X-Device-API-Key` header on every cycle; the backend looks it up by exact match (the column is named `key_hash` for legacy reasons but stores the token, not a bcrypt hash — bcrypt-per-verify would be 80 ms × ~2800 cycles/day and is impractical at IoT scale).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | `uuid` | `PK DEFAULT gen_random_uuid()` | Key identifier |
| device_id | `uuid` | `FK → devices(id) ON DELETE RESTRICT` | Parent device |
| key_hash | `varchar(255)` | `NOT NULL` | Opaque lookup token (column name is legacy) |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Key creation timestamp |
| expires_at | `timestamptz` | `NULL` | Optional key expiration |
| last_used_at | `timestamptz` | `NULL` | Last successful auth timestamp |
| deleted_at | `timestamptz` | `NULL` | Soft-delete (revocation) timestamp |

Design decisions:
- Partial unique index on `key_hash WHERE deleted_at IS NULL` allows key rotation: a new key with the same token can be issued after the old one is revoked
- The plain token is returned by `POST /api/v1/devices/:id/api-keys` exactly once and never stored
- Tokens are 32-byte base64url-encoded random values (256 bits of entropy)
- One active token per device at a time: `POST .../api-keys` returns 409 if an active key exists — revoke first, then issue

### device_share_links

Temporary read-only capabilities for unauthenticated guests. Multiple active
links are allowed per device. Tokens are returned once and only their SHA-256
hash is persisted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | `uuid` | `PK DEFAULT gen_random_uuid()` | Share-link identifier |
| device_id | `uuid` | `FK → devices(id) ON DELETE RESTRICT` | Shared device |
| created_by | `uuid` | `FK → users(id) ON DELETE RESTRICT` | Issuing owner |
| token_hash | `varchar(64)` | `NOT NULL UNIQUE` | SHA-256 of the random link token |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Issuance time |
| expires_at | `timestamptz` | `NOT NULL` | Expiry (1, 2, 4, or 8 hours after issue) |
| revoked_at | `timestamptz` | `NULL` | Early-revocation timestamp |

Guest access also verifies that the device is not soft-deleted. Expired and
revoked rows remain for audit and are excluded from active-link listing and
guest authorization.

### password_reset_tokens

One-time-use password reset tokens (migration 018). The raw token is sent only by email; the DB stores its SHA-256 hash, so a DB leak does not yield working reset links. The `UNIQUE` index on `token_hash` is the lookup path used by consume.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | `uuid` | `PK DEFAULT gen_random_uuid()` | Token identifier |
| user_id | `uuid` | `NOT NULL, FK → users(id) ON DELETE CASCADE` | Token owner |
| token_hash | `text` | `NOT NULL UNIQUE` | SHA-256 of the raw reset token |
| ip_address | `text` | `NOT NULL` | Requesting IP (rate-limit probe) |
| expires_at | `timestamptz` | `NOT NULL` | Expiry (1 hour after issue) |
| used_at | `timestamptz` | `NULL` | Set when the token is consumed |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Issue time |

### location_ingest_keys

Global idempotency keys for device batch ingestion (migration 021). Not partitioned, so uniqueness is enforced across all location partitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| device_id | `uuid` | `PK, FK → devices(id) ON DELETE RESTRICT` | Device identifier |
| sequence_id | `bigint` | `PK, CHECK (sequence_id > 0)` | Client-assigned batch sequence |
| recorded_at | `timestamptz` | `NOT NULL` | Batch timestamp (first point) |
| created_at | `timestamptz` | `NOT NULL DEFAULT NOW()` | Insert time |

## Foreign Key Rules

Almost all foreign keys use `ON DELETE RESTRICT` — you cannot delete a user or device that has active references in child tables without revoking/removing those references first. The one exception is `password_reset_tokens.user_id`, which cascades so a hard-deleted user takes their short-lived reset tokens with them.

| Child Table | Parent Table | FK Column | Rule |
|-------------|-------------|-----------|------|
| user_device_access | users | user_id | RESTRICT |
| user_device_access | devices | device_id | RESTRICT |
| locations | devices | device_id | RESTRICT |
| device_api_keys | devices | device_id | RESTRICT |
| device_share_links | devices | device_id | RESTRICT |
| device_share_links | users | created_by | RESTRICT |
| password_reset_tokens | users | user_id | **CASCADE** |
| location_ingest_keys | devices | device_id | RESTRICT |

## Soft Deletes

Users, devices, API keys, and access grants use soft deletes (`deleted_at`). Rows with `deleted_at IS NOT NULL` are filtered out of all application queries via partial indexes and `WHERE` clauses. The `locations` table does **not** use soft deletes — data is purged by dropping entire partitions.

## Partitioning

The `locations` table is partitioned by `RANGE (recorded_at)` with monthly partitions managed by [pg_partman](extensions.md). Partitions are automatically created 4 months ahead and dropped after 12 months. Daily maintenance runs at 03:00 UTC via pg_cron.

## Migration History

| # | File | Description |
|---|------|-------------|
| 001 | `000001_extensions` | Enable pgcrypto, pg_partman, pg_cron |
| 002 | `000002_create_user_role_enum` | Create `user_role` enum |
| 003 | `000003_create_users` | Create `users` table |
| 004 | `000004_create_devices` | Create `devices` table |
| 005 | `000005_create_user_device_access` | Create `user_device_access` pivot |
| 006 | `000006_create_locations` | Create `locations` (partitioned) |
| 007 | `000007_configure_partman_locations` | Register partitions with pg_partman |
| 008 | `000008_create_device_api_keys` | Create `device_api_keys` |
| 009 | `000009_create_user_triggers` | super_admin immutability triggers |
| 010 | `000010_add_user_name_lastname` | Add name/lastname to users |
| 011 | `000011_add_must_change_password` | Add must_change_password to users |
| 012 | `000012_align_users_with_authula` | Add email_verified, image; widen name |
| 013 | `000013_add_device_vehicle_type` | Add device_vehicle_type enum and vehicle_type column to devices |
| 014 | `000014_drop_locations_satellites` | Remove redundant `satellites` column from `locations` |
| 015 | `000015_add_locations_battery_voltage` | Add `battery_voltage` column for device-health telemetry |
| 016 | `000016_add_locations_signal_strength` | Add `signal_strength` column for cellular RSSI telemetry |
| 017 | `000017_enforce_one_active_api_key_per_device` | Enforce one active API key per device |
| 018 | `000018_create_password_reset_tokens` | Create password reset tokens |
| 019 | `000019_add_device_last_contact_at` | Add `last_contact_at` for presence |
| 020 | `000020_rename_last_seen_to_last_contact` | Migrate legacy presence column to `last_contact_at` |
| 021 | `000021_create_location_ingest_keys` | Idempotency keys for batch ingestion |
| 022 | `000022_create_device_share_links` | Expiring, revocable guest location links |
