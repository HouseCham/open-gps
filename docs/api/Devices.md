# Devices API Documentation

Base URL: `/api/v1`

## Authentication

All `/api/v1/devices/*` endpoints require an active session cookie (`authula.session_token`). The cookie is set by Authula on sign-in / sign-up and sent automatically by the browser via `credentials: 'include'`. The middleware (`AuthSession`) reads the cookie, resolves the Authula actor, and materialises the local `domain.User` projection before any handler runs.

See [Authentication.md](./Authentication.md) for the full auth flow (sign-in/sign-up, OAuth2, password change, sign-out, etc.).

## Response Envelope

All responses follow a consistent envelope format:

```json
{
  "status_code": 200,
  "message": "success message",
  "data": { ... }
}
```

## Common Error Responses

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 400 | `invalid device id` | The `:id` path parameter is not a valid UUID |
| 400 | `invalid request body` | Request body failed validation |
| 401 | `unauthorized` | Missing or invalid session cookie |
| 403 | `forbidden` | User does not have the required access role on the device |
| 403 | `must_change_password` | `must_change_password` is true; only `/api/v1/auth/change-password` is reachable |
| 404 | `resource not found` | Device does not exist OR user has no access (security through obscurity) |
| 409 | `conflict` | A device with the given `uuid_firmware` already exists |
| 422 | `validation error` | Database constraint violation (e.g., foreign key) |

---

## Endpoints

### GET /api/v1/devices

Lists all devices the authenticated user has access to, paginated.

**Authorization:** Any authenticated user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (1-indexed) |
| `page_size` | int | 20 | Items per page (max 100) |

**Request**

```
GET /api/v1/devices?page=1&page_size=20
Cookie: authula.session_token=<cookie>
```

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "devices retrieved",
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "uuid_firmware": "esp32-001",
        "name": "Living Room GPS",
        "vehicle_type": "car",
        "created_at": "2024-01-15T10:30:00Z",
        "last_seen_at": "2024-06-10T08:45:00Z",
        "access_role": "owner"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "uuid_firmware": "esp32-002",
        "name": "Bike Tracker",
        "vehicle_type": "bicycle",
        "created_at": "2024-02-20T14:00:00Z",
        "last_seen_at": null,
        "access_role": "editor"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 2,
      "total_pages": 1
    }
  }
}
```

**Fields (`items[]`):**
- `id` — Device UUID
- `uuid_firmware` — ESP32 firmware UUID (unique per device)
- `name` — Human-readable device name
- `vehicle_type` — Vehicle category: `bicycle`, `motorcycle`, `car`, `truck`, `van`, or `other`
- `created_at` — ISO 8601 timestamp when device was registered
- `last_seen_at` — ISO 8601 timestamp of last IoT ping (null if never seen)
- `access_role` — User's role on this device: `owner`, `editor`, or `viewer`

**Fields (`pagination`):**
- `page` — Current page number
- `page_size` — Items per page
- `total` — Total number of devices
- `total_pages` — Total number of pages

---

### GET /api/v1/devices/:id

Retrieves a single device by ID, including the caller's access role and — for the device owner only — the full list of users that currently have access to it. Returns 404 if the device does not exist OR the user has no access to it (intentional security through obscurity — avoids revealing whether an ID exists).

The `users` array lets the owner render the access-management panel without a second round-trip. Viewers and editors always receive `"users": []`: the underlying lookup is skipped, so non-owners are not even billed for the projection.

**Authorization:** Any authenticated user with at least `viewer` access to the device.

**Request**

```
GET /api/v1/devices/:id
Cookie: authula.session_token=<cookie>
```

**Response `200 OK` (caller is owner)**

```json
{
  "status_code": 200,
  "message": "device retrieved",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uuid_firmware": "esp32-001",
    "name": "Living Room GPS",
    "vehicle_type": "car",
    "created_at": "2024-01-15T10:30:00Z",
    "last_seen_at": "2024-06-10T08:45:00Z",
    "access_role": "owner",
    "users": [
      {
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Olivia Owner",
        "email": "owner@example.com",
        "role": "owner",
        "access_granted_at": "2026-06-10T08:00:00Z"
      },
      {
        "user_id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Victor Viewer",
        "email": "viewer@example.com",
        "role": "viewer",
        "access_granted_at": "2026-06-14T12:00:00Z"
      }
    ]
  }
}
```

**Response `200 OK` (caller is viewer/editor)**

```json
{
  "status_code": 200,
  "message": "device retrieved",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uuid_firmware": "esp32-001",
    "name": "Living Room GPS",
    "vehicle_type": "car",
    "created_at": "2024-01-15T10:30:00Z",
    "last_seen_at": "2024-06-10T08:45:00Z",
    "access_role": "viewer",
    "users": []
  }
}
```

**Fields (`data`):**
- `id` — Device UUID
- `uuid_firmware` — ESP32 firmware UUID (unique per device)
- `name` — Human-readable device name
- `vehicle_type` — Vehicle category: `bicycle`, `motorcycle`, `car`, `truck`, `van`, or `other`
- `created_at` — ISO 8601 timestamp when device was registered
- `last_seen_at` — ISO 8601 timestamp of last IoT ping (null if never seen)
- `access_role` — Caller's role on this device: `owner`, `editor`, or `viewer`
- `users` — Array of every user that has (non-deleted) access to the device; populated only when `access_role` is `owner`, always `[]` otherwise

**Fields (`users[]` — owner response only):**
- `user_id` — User UUID
- `name` — User's display name
- `email` — User's email
- `role` — Role the user holds on the device: `owner`, `editor`, or `viewer`
- `access_granted_at` — ISO 8601 timestamp when the grant was created

**Error Responses**
- `400` — Invalid device ID format
- `401` — Unauthorized
- `404` — Device not found or no access

---

### POST /api/v1/devices

Creates a new device and grants the requesting user `owner` access to it.

**Authorization:** Any authenticated user.

**Request**

```
POST /api/v1/devices
Cookie: authula.session_token=<cookie>
Content-Type: application/json

{
  "uuid_firmware": "esp32-003",
  "name": "Office Tracker",
  "vehicle_type": "car"
}
```

**Fields (request body):**
| Field | Type | Required | Validation |
|-------|------|----------|-------------|
| `uuid_firmware` | string | Yes | Must be a valid UUID format |
| `name` | string | Yes | Min 1 char, max 255 chars |
| `vehicle_type` | string | Yes | One of: `bicycle`, `motorcycle`, `car`, `truck`, `van`, `other` |

**Response `201 Created`**

```json
{
  "status_code": 201,
  "message": "device created",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "uuid_firmware": "esp32-003",
    "name": "Office Tracker",
    "vehicle_type": "car",
    "created_at": "2024-06-14T12:00:00Z",
    "last_seen_at": null
  }
}
```

**Error Responses**
- `400` — Invalid request body or validation failure
- `401` — Unauthorized
- `409` — A device with the given `uuid_firmware` already exists

---

### PUT /api/v1/devices/:id

Updates a device's display name and/or vehicle type.

**Authorization:** Requires `editor` or `owner` access role on the device.

**Request**

```
PUT /api/v1/devices/:id
Cookie: authula.session_token=<cookie>
Content-Type: application/json

{
  "name": "New Device Name",
  "vehicle_type": "van"
}
```

**Fields (request body):**
| Field | Type | Required | Validation |
|-------|------|----------|-------------|
| `name` | string | Yes | Min 1 char, max 255 chars |
| `vehicle_type` | string | No | One of: `bicycle`, `motorcycle`, `car`, `truck`, `van`, `other`. Omitting this field leaves the current value unchanged. |

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "device updated",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uuid_firmware": "esp32-001",
    "name": "New Device Name",
    "vehicle_type": "van",
    "created_at": "2024-01-15T10:30:00Z",
    "last_seen_at": "2024-06-10T08:45:00Z"
  }
}
```

**Error Responses**
- `400` — Invalid device ID or request body
- `401` — Unauthorized
- `403` — User has insufficient access role (needs at least `editor`)
- `404` — Device not found or no access

---

### DELETE /api/v1/devices/:id

Soft-deletes a device by setting `deleted_at = NOW()`. The device row is NOT physically removed. This operation is idempotent — re-deleting an already-deleted device succeeds silently.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
DELETE /api/v1/devices/:id
Cookie: authula.session_token=<cookie>
```

**Response `204 No Content`**

No response body is returned.

**Error Responses**
- `400` — Invalid device ID
- `401` — Unauthorized
- `403` — User has insufficient access role (needs `owner`)
- `404` — Device not found or no access

---

## Device Access Roles

Each user-device relationship has a role that determines allowed operations:

| Role | Permissions |
|------|-------------|
| `owner` | Full CRUD access — can read, update, delete the device and manage other users' access |
| `editor` | Can read and update the device, but cannot delete or manage access |
| `viewer` | Read-only access to the device |

Role hierarchy: `viewer (1) < editor (2) < owner (3)`

---

## Device Access Management

The original creator of a device is the only `owner` for the device's lifetime. Owners can grant `viewer` access to additional users, list who has access, and revoke access. Grants always assign the `viewer` role; ownership transfer is not supported.

All access-management endpoints are gated by `owner` access on the device and are exposed as a sub-resource of `/devices/:id`.

### POST /api/v1/devices/:id/access

Grants a user `viewer` access to the device. The granted role is always `viewer` — the request body does not include a role.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
POST /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/access
Cookie: authula.session_token=<owner-cookie>
Content-Type: application/json

{
  "user_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Fields (request body):**
| Field | Type | Required | Validation |
|-------|------|----------|-------------|
| `user_id` | string (UUID) | Yes | Must reference an existing, non-deleted user |

**Response `201 Created`**

```json
{
  "status_code": 201,
  "message": "access granted",
  "data": {
    "user_id": "660e8400-e29b-41d4-a716-446655440001",
    "device_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "viewer",
    "created_at": "2026-06-14T12:00:00Z"
  }
}
```

**Error Responses**
- `400` — Invalid device id, invalid user id in body, or invalid request body
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Target `user_id` does not exist or has been deleted
- `409` — Caller attempted to grant access to themselves (would overwrite their `owner` role)

The grant is idempotent: re-granting the same `user_id` returns the existing (re-activated) grant rather than creating a duplicate.

---

### GET /api/v1/devices/:id/access

Lists every user that currently has access to the device, with their role and when the grant was created. The list includes the owner.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
GET /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/access
Cookie: authula.session_token=<owner-cookie>
```

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "device access list retrieved",
  "data": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Olivia Owner",
      "email": "owner@example.com",
      "role": "owner",
      "access_granted_at": "2026-06-10T08:00:00Z"
    },
    {
      "user_id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Victor Viewer",
      "email": "viewer@example.com",
      "role": "viewer",
      "access_granted_at": "2026-06-14T12:00:00Z"
    }
  ]
}
```

**Error Responses**
- `400` — Invalid device id
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access

---

### DELETE /api/v1/devices/:id/access/:userId

Revokes a user's access to the device by soft-deleting the row in `user_device_access` (the row stays in the table for audit, but is filtered out of all queries).

**Authorization:** Requires `owner` access role on the device.

**Request**

```
DELETE /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/access/660e8400-e29b-41d4-a716-446655440001
Cookie: authula.session_token=<owner-cookie>
```

**Response `204 No Content`**

No response body is returned.

**Error Responses**
- `400` — Invalid device id, invalid `userId`, or caller tried to revoke themselves (`cannot_revoke_self`)
- `401` — Unauthorized
- `403` — Caller is not the device owner, or target is another owner
- `404` — Target `userId` has no active access grant to the device

---

## Device API Keys

IoT devices authenticate to the API not with a session cookie but with a per-device opaque lookup token carried in the `X-Device-API-Key` header. The owner of a device issues the token through these endpoints and flashes it onto the device firmware.

A device has **at most one active key at any time**. Creating a new key soft-deletes the prior active key so the firmware update path stays a single-value lookup and a stolen firmware blob can be revoked by rotation alone.

The plain token is returned **only at creation time**. `GET` and `DELETE` never surface it; the backend has no copy outside the response payload.

### POST /api/v1/devices/:id/api-keys

Issues a fresh key for the device. Revokes any prior active key in the same transaction so the single-active invariant always holds.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
POST /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/api-keys
Cookie: authula.session_token=<owner-cookie>
```

No request body.

**Response `201 Created`**

```json
{
  "status_code": 201,
  "message": "api key issued",
  "data": {
    "id": "ae0a8d4f-d0f9-4fd0-ad7d-4f40d87c098f",
    "created_at": "2026-07-07T15:32:08Z",
    "plain_key": "50I_rlGuoF9EONVelnUahPqKr1vDy6H1hZ0BrXFVldQ"
  }
}
```

**Fields (`data`):**
- `id` — UUID of the new key row
- `created_at` — ISO 8601 timestamp
- `plain_key` — The lookup token to flash onto the device. **Returned exactly once.** Store it in the firmware's secure storage (NVS / Preferences) and never log it.

**Error Responses**
- `400` — Invalid device id
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access

---

### GET /api/v1/devices/:id/api-keys

Lists every active key for the device. Returns metadata only — no token, no hash.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
GET /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/api-keys
Cookie: authula.session_token=<owner-cookie>
```

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "api keys listed",
  "data": [
    {
      "id": "ae0a8d4f-d0f9-4fd0-ad7d-4f40d87c098f",
      "created_at": "2026-07-07T15:32:08Z",
      "last_used_at": null,
      "expires_at": null
    }
  ]
}
```

**Error Responses**
- `400` — Invalid device id
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access

---

### DELETE /api/v1/devices/:id/api-keys/:keyId

Soft-deletes a single key. Idempotent — revoking an already-revoked or unknown key returns `204`.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
DELETE /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/api-keys/ae0a8d4f-d0f9-4fd0-ad7d-4f40d87c098f
Cookie: authula.session_token=<owner-cookie>
```

**Response `204 No Content`**

No response body is returned.

**Error Responses**
- `400` — Invalid device id or `keyId`
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access