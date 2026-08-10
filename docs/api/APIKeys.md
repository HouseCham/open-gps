# Device API Keys

Base URL: `/api/v1`

## Overview

IoT devices authenticate to the API not with a session cookie but with a per-device opaque lookup token carried in the `X-Device-API-Key` header. The owner of a device issues the token through these endpoints and flashes it onto the device firmware.

A device has **at most one active key at any time**. Issuing a new key soft-deletes the prior active key in the same transaction, so the firmware-update path stays a single-value lookup and a leaked firmware blob can be revoked by rotation alone.

The plain token is returned **only at creation time**. `GET` and `DELETE` never surface it; the backend has no copy outside the response payload.

See [Authentication.md -> IoT device auth](./Authentication.md#iot-device-auth-x-device-api-key) for the on-the-wire shape of the token and how the firmware uses it.

## Endpoints

| Method | Path | Scope | Auth |
|--------|------|-------|------|
| `POST` | `/devices/:id/api-keys` | One device | Session + `owner` on device |
| `GET`  | `/devices/:id/api-keys` | One device | Session + `owner` on device |
| `DELETE` | `/devices/:id/api-keys/:keyId` | One device | Session + `owner` on device |
| `GET`  | `/api-keys` | **Global** — every device the caller has access to | Session |

The per-device trio (`POST` / `GET` / `DELETE` under `/devices/:id/api-keys`) drives the device detail page; the new global `GET /api-keys` drives the `/api-keys` admin table and joins `device_api_keys` with `devices` so the table renders the Device column without a second round-trip per row.

## Authentication

All endpoints require an active session cookie (`authula.session_token`). The per-device trio additionally requires `owner` access role on the target device (enforced by `RequireDeviceRole`); the global listing only requires an authenticated session because the SQL `INNER JOIN user_device_access` filters by `user_id` and the response carries metadata only (no token, no hash).

See [Authentication.md](./Authentication.md) for the full auth flow.

## Response Envelope

All responses follow the standard envelope:

```json
{
  "status_code": 200,
  "message": "success message",
  "data": { ... }
}
```

## Common Error Responses

| Status Code | Meaning |
|-------------|---------|
| 400 | Invalid `:id` (or `:keyId` for DELETE) — must be a UUID |
| 401 | Missing or invalid session cookie |
| 403 | Caller is not the device owner (per-device endpoints only) |
| 403 | `must_change_password` is true; only `/api/v1/auth/change-password` is reachable |
| 404 | Device does not exist OR user has no access (security through obscurity) |
| 409 | The device already has an active key — revoke it first to issue a new one |

---

## Endpoints

### POST /api/v1/devices/:id/api-keys

Issues a fresh key for the device. Revokes any prior active key in the same transaction so the single-active invariant always holds.

The response carries the plain token — this is the **one place** it ever travels on the wire. The admin UI must display it and discard; the service retains no copy.

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
- `created_at` — ISO 8601 timestamp when the key was issued
- `plain_key` — The lookup token to flash onto the device. **Returned exactly once.** Store it in the firmware's secure storage (NVS / Preferences) and never log it.

**Error Responses**
- `400` — Invalid device id
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access

---

### GET /api/v1/devices/:id/api-keys

Lists every active key for a single device. Returns metadata only — no token, no hash. Drives the keys panel on the device detail page.

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

**Fields (`data[]`):**
- `id` — UUID of the key row
- `created_at` — ISO 8601 timestamp when the key was issued
- `last_used_at` — ISO 8601 timestamp of the most recent IoT auth, or `null` if never used
- `expires_at` — ISO 8601 expiration timestamp, or `null` if the key never expires

**Error Responses**
- `400` — Invalid device id
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access

---

### DELETE /api/v1/devices/:id/api-keys/:keyId

Soft-deletes a single key. **Idempotent** — revoking an already-revoked or unknown key returns `204` without error.

**Authorization:** Requires `owner` access role on the device.

**Request**

```
DELETE /api/v1/devices/550e8400-e29b-41d4-a716-446655440000/api-keys/ae0a8d4f-d0f9-4fd0-ad7d-4f40d87c098f
Cookie: authula.session_token=<owner-cookie>
```

**Response `204 No Content`**

No response body is returned.

**Error Responses**
- `400` — Invalid `:id` or `:keyId`
- `401` — Unauthorized
- `403` — Caller is not the device owner
- `404` — Device does not exist or caller has no access

---

### GET /api/v1/api-keys

Global listing: every active api key across every device the caller has access to. Each entry is enriched with the owning device's display name so the admin table can render the Device column without a second round-trip per row.

The SQL `INNER JOIN user_device_access ON uda.user_id = $1` is the access control — only devices the caller has any role on are returned. Soft-deleted keys, devices, and access grants are filtered out.

**Authorization:** Any authenticated user. Per-device role gating is intentionally relaxed here because the response carries metadata only (no token, no hash).

**Request**

```
GET /api/v1/api-keys
Cookie: authula.session_token=<cookie>
```

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "api keys listed",
  "data": [
    {
      "id": "ae0a8d4f-d0f9-4fd0-ad7d-4f40d87c098f",
      "name": "Delivery Van #3",
      "device_name": "Delivery Van #3",
      "device_id": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-07-07T15:32:08Z"
    },
    {
      "id": "b1f2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Bike Tracker",
      "device_name": "Bike Tracker",
      "device_id": "550e8400-e29b-41d4-a716-446655440001",
      "created_at": "2026-06-08T11:14:02Z"
    }
  ]
}
```

**Fields (`data[]`):**
- `id` — UUID of the key row
- `name` — Display name of the owning device (the "Device" column)
- `device_name` — Display name of the owning device (explicit form of `name`; both fields carry the same value)
- `device_id` — UUID of the owning device. Required to drive the per-row revoke flow (`DELETE /api/v1/devices/:id/api-keys/:keyId`).
- `created_at` — ISO 8601 timestamp when the key was issued

**Error Responses**
- `401` — Unauthorized
- `403` — `must_change_password` is true

---

## Token lifecycle

1. **Issue** — `POST /api/v1/devices/:id/api-keys` returns the `plain_key` once. The backend stores only the lookup value (a column named `hash` for historical reasons but the value is the token itself, see [Authentication.md -> IoT device auth](./Authentication.md#why-not-bcrypt)) and the device binding. No copy of the plain key is ever persisted.
2. **Flash** — The owner flashes the firmware with the token stored in NVS / Preferences (ideally encrypted at rest with the MCU's secure element).
3. **Authenticate** — On every cycle the device sends the token in the `X-Device-API-Key` header. The IoT middleware (`RequireDeviceAPIKey`) hashes-and-looks-up against `:uuid_firmware` and rejects mismatches.
4. **Rotate** — Issuing a new key soft-deletes the prior active key in the same transaction. The firmware update pushes the new key; from the moment the cell reconnects, only the new token authenticates. The old token is dead the instant `POST` returns.
5. **Revoke** — `DELETE /api/v1/devices/:id/api-keys/:keyId` soft-deletes the row. Idempotent: revoking an already-revoked or unknown key returns `204`. The next `GET /api/v1/api-keys` no longer surfaces it.