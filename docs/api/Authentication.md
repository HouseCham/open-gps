# Authentication

The API uses **Authula** (v1.11.0) — an embedded Go auth library — for authentication. Authula runs in-process and owns its own Postgres-backed tables (users, sessions, accounts, verifications) that live in the same database as the application tables.

## Auth model

Authentication is **cookie-based**. After sign-in or sign-up, Authula's session plugin sets an HTTP-only cookie that the browser sends automatically on every subsequent request. The frontend never sees a token; it just calls `fetch` with `credentials: 'include'`.

| Aspect | Value |
|---|---|
| Cookie name | `authula.session_token` |
| `HttpOnly` | true |
| `SameSite` | `lax` |
| `Secure` | true when `APP_ENV=production`, false otherwise |
| TTL | 24 h, sliding renewal every 5 min while in use |
| Concurrent sessions per user | 5 (configurable in `config.toml`) |
| First user | auto-promoted to `super_admin` |

Sign-up auto-signs-in: the same response that registers the user sets the session cookie.

## Endpoints

All `/api/auth/*` routes are served by Authula's net/http handler mounted as a Fiber catch-all (`app.All("/api/auth/*", ...)`), with one override — `/api/auth/me` is served by a custom Fiber handler (see below).

### Email + password

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/email-password/sign-up` | Register. Auto-sign-in. |
| POST | `/api/auth/email-password/sign-in` | Sign in. |
| POST | `/api/auth/sign-out` | Invalidate the current session. |
| POST | `/api/auth/email-password/request-password-reset` | Start a password reset (sends email). |
| POST | `/api/auth/email-password/change-password` | Authula's built-in change-password (requires session). |

**Request**

```json
{
  "email": "user@example.com",
  "password": "secure-password"
}
```

### OAuth2 (Google)

Only mounted when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/oauth2/authorize/google` | Start the Google OAuth2 flow. |
| GET | `/api/auth/oauth2/callback/google` | OAuth2 callback. Sets the session cookie on success. |

### `/api/auth/me` (custom Fiber handler)

Authula's built-in `/me` route registers its session-validation hook under `PluginID: "session.auth"`, but the core `/me` route carries no plugin metadata, so the hook never fires and the route always 401s. We override it with a Fiber handler that reads the actor and local user already materialised by `AuthSession` and returns the same `{ user: { id, email, name } }` shape the frontend expects:

```json
{
  "user": {
    "id": "f8b8f5a4-1f7e-4d2a-9c0b-9e6f9b2c1a01",
    "email": "user@example.com",
    "name": "User"
  }
}
```

### Other

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/.well-known/jwks.json` | Public JWKS for the EdDSA keys Authula uses to sign JWTs. |
| POST | `/api/auth/token/refresh` | Refresh an issued JWT (only relevant if your client holds a JWT — the browser uses the cookie directly). |

For the request/response shapes on each Authula route, see the [Authula docs](https://github.com/Authula/authula).

## Middleware pipeline

`AuthSession` is the single middleware gating every protected route. It runs three steps in order:

1. Read `authula.session_token` from the request cookies.
2. Hash the cookie value, look up the matching session in Authula's `sessions` table, and build the actor (`*authula.Actor`).
3. Materialise the local `domain.User` projection. The very first time a given email is seen, a row is inserted into the app's `users` table (linked by email). If the local table was empty at that moment, the row gets `role = super_admin`; otherwise `role = user`. This is what makes the "first user is super_admin" invariant work for both email-password sign-ups and OAuth2 sign-ins.

After `AuthSession` populates the locals, downstream middlewares can run:

| Middleware | Purpose | Failure |
|---|---|---|
| `RequirePasswordChanged` | Blocks users with `must_change_password = true` from anything but changing their password. | 403 `must_change_password` |
| `RequireUserRole(super_admin)` | Global role gate for admin endpoints. | 403 `forbidden` |
| `RequireDeviceRole(role)` | Per-device role gate (`viewer`/`editor`/`owner`). | 403/404 |
| `RequireDeviceAPIKey(queries)` | IoT auth: validates the `X-Device-API-Key` header against `:uuid_firmware` and stamps the resolved device id in locals. Used by IoT-only routes (e.g. `POST /locations`). | 401 / 404 |

```text
c.Locals("claims") → *authula.Actor
c.Locals("user")   → *domain.User
c.Locals("device_id") → uuid.UUID   // set by RequireDeviceAPIKey
```

## Application-level auth endpoints

### Password recovery (forgot password)

Two endpoints under `/api/v1/auth/{generate,consume}-pwd-recovery-token` cover the password-recovery flow. They are public (no session required) so a user who has lost their password can still recover it. Tokens are single-use, hashed at rest, expire in 1 hour, and are rate-limited per email + per IP.

See [PasswordRecovery.md](./PasswordRecovery.md) for the full contract, including the anti-enumeration and rate-limit semantics.

### `POST /api/v1/auth/change-password`

Change the signed-in user's password. Verifies the current password against Authula's credential store, hashes the new one, writes it back, and clears the local `must_change_password` flag. **Not** gated by `RequirePasswordChanged` — a user who hasn't changed their temporary password yet must be able to hit this endpoint.

**Authorization:** any authenticated user (their own session).

**Request**

```json
{
  "old_password": "current-password",
  "new_password": "new-password-min-8-chars"
}
```

**Response `200 OK`**

```json
{ "status_code": 200, "message": "password changed", "data": false }
```

| Status | Meaning |
|---|---|
| 200 | Password changed; `must_change_password` cleared. |
| 400 | Invalid body (e.g. `new_password` < 8 chars) or wrong current password. |
| 401 | Missing/invalid session cookie. |

## System bootstrap

### `GET /api/v1/system/bootstrap`

Returns `true` when the local `users` table is empty, `false` otherwise. The frontend uses it to decide whether to send the visitor to the sign-up page (first user becomes `super_admin`) or straight to the sign-in page.

**Authorization:** intentionally unauthenticated — this endpoint has to answer the question *before* the user signs in. It only exposes a boolean a caller could derive anyway.

**Response `200 OK`**

```json
{ "status_code": 200, "message": "ok", "data": true }
```

## Sign out

```
POST /api/auth/sign-out
```

Invalidates the session in Authula's `sessions` table and clears the cookie. Idempotent.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTHULA_SECRET` | Yes | — | 32-byte hex string. `openssl rand -hex 32`. |
| `AUTHULA_BASE_URL` | No | `https://localhost` (from `config.toml`) | Public origin. Used in redirect/email links and OAuth callback URL. |
| `DATABASE_URL` | Yes | — | Postgres URL. Authula uses the same database and creates its own tables on first init. |
| `APP_ENV` | No | `development` | Set to `production` to flip the session cookie's `Secure` flag on. |
| `APP_NAME` | No | `gps-tracker-api` | Display name in Authula logs and emails. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | — | When both are set, the Google OAuth2 plugin is enabled and `/api/auth/oauth2/*` routes become live. |
| `CORS_ALLOWED_ORIGINS` | No | empty | Comma-separated origins. When non-empty, the CORS middleware is enabled with `credentials: true`. Required when the frontend and API live on different origins. |

---

## IoT device auth (`X-Device-API-Key`)

The IoT ingest route (`POST /api/v1/devices/:uuid_firmware/locations`) uses **per-device opaque lookup tokens** instead of session cookies. Devices cannot store cookies — they have no user agent, no persistent storage beyond a tiny flash partition, and run for weeks at a time on battery power without ever touching the dashboard. The token travels in a single header on every cycle.

### Token shape

- 32 random bytes (256 bits of entropy) base64url-encoded.
- 43 characters of `[A-Za-z0-9_-]` — header-safe, no escaping required.
- One active token per device at any time; creating a new one (via `POST /api/v1/devices/:id/api-keys`) soft-deletes the prior active token.

### How it works

1. The device owner calls `POST /api/v1/devices/:id/api-keys` (session auth + owner role) and receives a `plain_key` in the response. The backend does **not** retain the plain key beyond this response.
2. The owner flashes the firmware with the token stored in NVS / Preferences (ideally encrypted at rest with the MCU's secure element).
3. On every cycle, the device opens an HTTPS connection and sends:
   ```
   POST /api/v1/devices/<uuid_firmware>/locations
   X-Device-API-Key: <token>
   Content-Type: application/json
   {...}
   ```
4. The backend middleware (`RequireDeviceAPIKey`) does the following:
   - 401 if the header is missing.
   - 404 if `:uuid_firmware` does not resolve to an active device.
   - 401 if no row in `device_api_keys` matches the token (or the row is soft-deleted / expired).
   - 401 if the matched key's `device_id` does not match the device id resolved from `:uuid_firmware`. **This prevents a token leaked from device A being used to write to device B's location history.**
   - On success: stamps the resolved device id in `c.Locals("device_id")` and calls `c.Next()`.

### Why not bcrypt?

The original schema anticipated bcrypt-on-verify, but bcrypt at default cost (~80 ms) at IoT scale (one POST / 30 s × 2 880 cycles/day × 100 devices = ~7 hours of CPU/day just for auth) is impractical. The "hash" column name is now misleading — it stores the token directly. We rely on TLS to protect the token in transit, on the partial unique index to keep lookups a single seek, and on rotation to revoke compromised tokens.

### Rotation

Issuing a new key for a device soft-deletes the prior active key in the same transaction. The firmware update pushes the new key; from the moment the cell reconnects, only the new token authenticates. The old token is dead the instant `POST /api/v1/devices/:id/api-keys` returns.

### Threat model

| Concern | Mitigation |
|---|---|
| Token leaked over the wire | TLS terminates at nginx; the X-Device-API-Key is never logged in access logs. |
| Token leaked from firmware flash | Rotate via `POST /api/v1/devices/:id/api-keys` and reflash. |
| Token replayed against another device | Rejected by the key's `device_id` vs `:uuid_firmware` check. |
| Rogue call to the endpoint with no token | `401 missing X-Device-API-Key header`. |
| Brute-force guess of a 32-byte token | 256 bits of entropy — practically impossible. |
| Database exfiltration | Token IS the lookup key (not a hash), so reading the DB is enough. Mitigation: row-level TLS at the DB layer; rotate every leaked device. |