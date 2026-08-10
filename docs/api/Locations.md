# Locations API Documentation

Base URL: `/api/v1`

The `locations` endpoint group serves both the IoT ingestion path (write, device-authenticated) and the dashboard read path (session-authenticated). Device-auth routes are reachable via `X-Device-API-Key`; user-auth routes follow the standard session-cookie + per-device RBAC pipeline. See [Authentication.md](./Authentication.md) for both auth models and [Devices.md](./Devices.md#device-api-keys) for how devices obtain their tokens.

---

## GET /api/v1/devices/:id/locations/latest

Returns the device's most recent location — the one-row read that powers the dashboard's "last location" preview on the device-detail page.

**Authorization:** Session cookie (Authula) + `viewer` (or higher) access on the device. The access check is enforced by `middleware.RequireDeviceRole(viewer)`; a user without access receives a `404` (security-through-obscurity, same as the rest of the per-device routes).

**Path Parameters**

| Parameter | Description |
|-----------|-------------|
| `id` | Device UUID. Must resolve to an active device the caller has at least `viewer` access to. |

**Request**

```
GET /api/v1/devices/550e8400-e29b-41d4-a716-446655440001/locations/latest
Cookie: authula.session_token=...
```

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "latest location retrieved",
  "data": {
    "device_id": "550e8400-e29b-41d4-a716-446655440001",
    "recorded_at": "2026-07-15T12:00:00Z",
    "latitude": 19.432608,
    "longitude": -99.133207,
    "altitude": 2240.5,
    "speed": 45.3,
    "accuracy": 4.1,
    "battery_voltage": 3.72,
    "signal_strength": 23
  }
}
```

Nullable telemetry fields (`altitude`, `speed`, `accuracy`, `battery_voltage`, `signal_strength`) are returned as JSON `null` when the device did not report them on that cycle.

**Error Responses**

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 400 | `invalid device id` | `:id` is not a valid UUID |
| 401 | `unauthorized` | No session cookie or session expired |
| 403 | `must change password` | Caller has `must_change_password=true` |
| 404 | (per RBAC) | Caller has no access to the device (security-through-obscurity) |
| 404 | `no location reported for this device yet` | The device has never sent a location row |

> **Why a 404 for "never reported":** `GETLatestLocationForDevice` is `LIMIT 1` on an empty result set, which surfaces as `pgx.ErrNoRows` and maps to `domain.ErrNotFound`. The handler turns it into a distinct 404 so the dashboard can render a "Never seen" badge without inspecting 5xx errors.

> **Why no `?include_history=true` flag:** the paginated history endpoint (`GET /api/v1/devices/:id/locations`) is a separate, follow-up route — it lands alongside the `LivePreview` component. Combining it here would mix the latest (object) shape with the history (paginated list) shape; keeping them separate matches the "uniform envelope per endpoint" rule.

---

## POST /api/v1/devices/:uuid_firmware/locations

Persists one GPS + telemetry fix reported by the device. Called once per ~30 s cycle. The handler enforces numeric range checks on top of the DTO's `validate_struct` validation; idempotency on `(device_id, recorded_at)` is enforced at the database layer via `ON CONFLICT DO NOTHING` — clients can retry safely without producing duplicates.

**Authorization:** Requires the IoT device lookup token (issued via `POST /api/v1/devices/:id/api-keys`).

**Headers**

| Header | Required | Description |
|--------|----------|-------------|
| `X-Device-API-Key` | Yes | Opaque 256-bit lookup token issued for the device |
| `Content-Type` | Yes | `application/json` |

**Path Parameters**

| Parameter | Description |
|-----------|-------------|
| `uuid_firmware` | ESP32 firmware UUID (matches the `uuid_firmware` of an existing, non-deleted device). The middleware resolves this to the device id and verifies the token belongs to the same device before the handler runs. |

**Request**

```
POST /api/v1/devices/aaaaaaaa-bbbb-cccc-dddd-000000000001/locations
Content-Type: application/json
X-Device-API-Key: 50I_rlGuoF9EONVelnUahPqKr1vDy6H1hZ0BrXFVldQ

{
  "recorded_at": "2026-07-07T12:00:00Z",
  "latitude": 19.432608,
  "longitude": -99.133207,
  "altitude": 2240.5,
  "speed": 45.3,
  "accuracy": 4.1,
  "battery_voltage": 3.72,
  "signal_strength": 23
}
```

**Fields (request body):**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `recorded_at` | string (RFC 3339 / ISO 8601) | Yes | `required`, RFC 3339 format | GPS fix timestamp from the device clock |
| `latitude` | number | Yes | `required`, `-90 ≤ x ≤ 90` | WGS84 latitude in decimal degrees |
| `longitude` | number | Yes | `required`, `-180 ≤ x ≤ 180` | WGS84 longitude in decimal degrees |
| `altitude` | number | No | `-500 ≤ x ≤ 10000` | Altitude above sea level (meters). `null` if the device could not read it |
| `speed` | number | No | `x ≥ 0` | Ground speed (m/s). `null` if unknown |
| `accuracy` | number | No | `x ≥ 0` | Position accuracy (meters). `null` if unknown |
| `battery_voltage` | number | No | `0 ≤ x ≤ 6` | Reported battery voltage (volts). `null` if not measured |
| `signal_strength` | integer | No | `0 ≤ x ≤ 31` | Cellular RSSI from `AT+CSQ` (`0`=−113 dBm, `31`=−51 dBm). `null` if unknown |

**Response `201 Created`**

```
HTTP/1.1 201 Created
Content-Type: text/plain; charset=utf-8
Content-Length: 7

Created
```

No response body. The status code conveys success; clients can read the inserted row back via `GET /api/v1/devices/:id/locations/latest`.

**Error Responses**

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 400 | `invalid request body` | Body failed the validator's per-field checks (range, required, RFC 3339) |
| 401 | `missing X-Device-API-Key header` | Header absent or empty |
| 401 | `invalid or expired api key` | Header present but no active key matches, OR the key's `device_id` does not match `:uuid_firmware` |
| 404 | `device not found` | `:uuid_firmware` does not resolve to an active device |

> **Idempotency:** `201 Created` does not mean "new row inserted" — the same `(device_id, recorded_at)` always returns 201 because the DB upserts with `ON CONFLICT DO NOTHING`. The contract is "the server has accepted your packet" not "a row was added". Clients can treat every 201 as success.

> **Order of operations in the handler:**
> 1. DTO validation (range, format) — `validate_struct` middleware.
> 2. Range re-check in the service layer (defence in depth).
> 3. Idempotent insert at the DB.

---

## Common questions

**Why is `device_id` not in the body?** It comes from the URL `:uuid_firmware` via the IoT auth middleware. The handler never reads the path param itself — only `c.Locals("device_id")` which the middleware verified against the token.

**Why does idempotency live in the DB layer?** ESP32 cellular radios have lossy links and the firmware retries every POST until it gets a response. Without idempotency a 30-second cycle can produce duplicates every time the network blips. `ON CONFLICT (device_id, recorded_at) DO NOTHING` makes retries a no-op.

**Why no paginated `GET /api/v1/devices/:id/locations`?** The paginated history endpoint is a separate, follow-up route that lands alongside the `LivePreview` component. Combining it with the `latest` endpoint would mix the latest (object) shape with the history (paginated list) shape; keeping them separate matches the "uniform envelope per endpoint" rule.

**Why aren't GPS-only devices rejected?** A bare GPS + ESP32 can fill in lat/lng/recorded_at/altitude/speed/accuracy; the other five fields are optional. The empty `signal_strength` case is common in indoor benches, etc.
