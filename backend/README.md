# GPS Tracker API

A Web API for managing GPS-equipped IoT devices (e.g., ESP32 modules) and ingesting/querying their location data. Built with Go, Fiber v3, and PostgreSQL.

## Architecture

Hexagonal Architecture (Ports & Adapters):

```
transport/http/  →  app/  →  domain/
     ↓                    ↑
     +------ infra/postgres/
```

- **`domain/`** — Core types and sentinel errors, zero external dependencies.
- **`app/`** — Business logic services and port interfaces (Repository).
- **`infra/postgres/`** — PostgreSQL adapters implementing port interfaces via sqlc-generated code.
- **`transport/http/`** — Fiber v3 HTTP handlers, middleware, and routing.

## Tech Stack

| Component | Library |
|---|---|
| Web Framework | [Fiber v3](https://github.com/gofiber/fiber) |
| Database | PostgreSQL with pgx/v5 pool |
| SQL Codegen | [sqlc](https://sqlc.dev) v1.31.1 |
| Validation | go-playground/validator v10 |
| UUID | google/uuid |
| Environment | joho/godotenv |

## Prerequisites

- Go 1.26.4+
- PostgreSQL (with pg_partman extension for partitioned locations)
- [sqlc](https://sqlc.dev) installed at `~/go/bin/sqlc`

## Getting Started

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL
```

### 2. Run database migrations

Use your preferred migration tool with the files in `../migrate/migrations/`.

### 3. Generate SQL code

```bash
~/go/bin/sqlc generate
```

This reads SQL queries from `queries/` and the schema from `../migrate/migrations/`, then generates Go code into `internal/infra/postgres/`.

### 4. Run the API

```bash
go run ./cmd/api
```

## API Endpoints

`/api/auth/*` is served by Authula except for the custom `GET /api/auth/me` and
`POST /api/auth/sign-out` handlers. The OAuth2 routes are available for Google
only when both Google OAuth credentials are configured. See
[`docs/api/Authentication.md`](../docs/api/Authentication.md) for Authula's
additional endpoints and authentication details.

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public health check; returns `{ "status": "ok" }`. |
| POST | `/api/auth/email-password/sign-in` | Authula. |
| POST | `/api/auth/email-password/sign-up` | Authula; the first local user becomes `super_admin`. |
| POST | `/api/auth/sign-out` | Clears the session cookie and invalidates the session. |
| POST | `/api/auth/email-password/request-password-reset` | Authula password-reset endpoint. |
| POST | `/api/auth/email-password/change-password` | Authula; session required. |
| GET | `/api/auth/.well-known/jwks.json` | Authula public signing keys. |
| POST | `/api/auth/token/refresh` | Authula token refresh. |
| GET | `/api/auth/oauth2/authorize/:provider` | Authula; Google when configured. |
| GET | `/api/auth/oauth2/callback/:provider` | Authula; Google when configured. |
| GET | `/api/auth/me` | Authenticated session; custom user projection. |
| GET | `/api/v1/system/bootstrap` | Public; reports whether the local user table is empty. |
| POST | `/api/v1/guest/share-links/consume` | Public link-token exchange for a temporary guest cookie. |
| GET | `/api/v1/guest/device/live` | Guest capability cookie; current location and presence only. |
| GET | `/api/v1/guest/device/stream` | Guest capability cookie; live SSE stream. |
| GET | `/api/v1/devices/count` | Authenticated; count of devices accessible to the caller. |
| GET | `/api/v1/devices` | Authenticated; paginated accessible devices. |
| GET | `/api/v1/devices/:id` | Authenticated with device access. |
| POST | `/api/v1/devices` | Authenticated; creator receives owner access. |
| PUT | `/api/v1/devices/:id` | Device `editor` or `owner`. |
| DELETE | `/api/v1/devices/:id` | Device `owner`; soft-deletes the device. |
| POST | `/api/v1/devices/:id/access` | Device `owner`; grants `viewer` access. |
| GET | `/api/v1/devices/:id/access` | Device `owner`; lists active access grants. |
| DELETE | `/api/v1/devices/:id/access/:userId` | Device `owner`; revokes a grant. |
| POST | `/api/v1/devices/:id/share-links` | Device `owner`; creates a temporary guest link. |
| GET | `/api/v1/devices/:id/share-links` | Device `owner`; lists active links. |
| DELETE | `/api/v1/devices/:id/share-links/:linkId` | Device `owner`; revokes a link. |
| POST | `/api/v1/devices/:id/api-keys` | Device `owner`; issues the device's API key. |
| GET | `/api/v1/devices/:id/api-keys` | Device `owner`; lists key metadata, never the token. |
| DELETE | `/api/v1/devices/:id/api-keys/:keyId` | Device `owner`; revokes a key. |
| GET | `/api/v1/api-keys` | Authenticated; lists key metadata for devices the caller can access. |
| POST | `/api/v1/devices/:uuid_firmware/locations` | Device API key in `X-Device-API-Key`; one location per request. |
| POST | `/api/v1/devices/:uuid_firmware/locations/batch` | Device API key in `X-Device-API-Key`; batch location ingestion. |
| GET | `/api/v1/devices/:id/locations/latest` | Device `viewer` or higher; latest location. |
| GET | `/api/v1/devices/:id/locations/live` | Device `viewer` or higher; location and presence snapshot. |
| GET | `/api/v1/devices/:id/locations/stream` | Device `viewer` or higher; live SSE stream. |
| GET | `/api/v1/devices/:id/locations` | Device `viewer` or higher; paginated history. |
| GET | `/api/v1/devices/:id/locations/route` | Device `viewer` or higher; bounded chronological route. |
| GET | `/api/v1/reports/overview` | Authenticated; filtered overview report. |
| GET | `/api/v1/reports/routes` | Authenticated; filtered routes report. |
| GET | `/api/v1/reports/health` | Authenticated; filtered device health report. |
| GET | `/api/v1/reports/data-quality` | Authenticated; filtered data-quality report. |
| GET | `/api/v1/reports/export?format=csv\|gpx` | Authenticated; CSV or GPX download. |
| GET | `/api/v1/users/me` | Authenticated; local profile projection. |
| GET | `/api/v1/users` | `super_admin`; lists other active users. |
| GET | `/api/v1/users/:id` | Own profile or `super_admin`; includes paginated devices. |
| POST | `/api/v1/users` | `super_admin`; creates a user with a temporary password. |
| PUT | `/api/v1/users/:id` | Own profile only. |
| DELETE | `/api/v1/users/:id` | Own account or `super_admin`; soft-deletes the user. |
| POST | `/api/v1/auth/change-password` | Authenticated; excluded from the must-change-password gate. |
| POST | `/api/v1/auth/generate-pwd-recovery-token` | Public after initialization; starts password recovery. |
| POST | `/api/v1/auth/consume-pwd-recovery-token` | Public after initialization; consumes a recovery token. |
| POST | `/api/v1/email/welcome` | `super_admin`; dispatches a welcome email. |

All `/api/v1/*` routes except `/system/bootstrap` are blocked until an active
local user exists. This includes routes that do not require an account session,
such as guest-link exchange and password recovery.

### Location and report query parameters

- History and route endpoints require `from`, `to`, and `time-zone`. Times use
  `YYYY-MM-DDTHH:MM:SS` in the supplied IANA time zone and are converted to UTC.
- Location history supports `page` and `page_size` (defaults: `1` and `20`,
  maximum page size: `100`). Route supports `max_points` (`2`–`1000`, default
  `1000`).
- Reports require the same `from`, `to`, and `time-zone` range; the range is
  limited to 31 days. Optional filters are comma-separated `device_ids` and
  `vehicle_type`. Export additionally requires `format=csv` or `format=gpx`.

### Real-time live location stream

Device presence is server-owned and derived from `devices.last_contact_at`:

- `GET /api/v1/devices/:id/locations/live` — REST snapshot: current device presence
  (`never_seen`, `online_moving`, `online_stationary`, `offline`) plus the
  latest location.
- `GET /api/v1/devices/:id/locations/stream` — SSE stream. Same-origin and
  authenticated via the existing http-only session cookie (native
  `EventSource` sends it automatically). Publishes snapshot, location,
  presence, keepalive and offline-expiry events.
- `GET /api/v1/devices/:id/locations/latest` — latest location, returning 404
  if the device has not reported one yet.

### Single-instance constraint

The live stream uses an in-memory publisher (`internal/infra/live/hub.go`)
and therefore requires exactly one API process. Replace that adapter with
shared pub/sub (e.g. Redis/Postgres LISTEN) before running multiple API
replicas so SSE events broadcast across instances.

### Authentication

Protected `/api/v1/*` routes require an active session cookie
(`authula.session_token`). The cookie is set by Authula on sign-in / sign-up and
sent automatically by the browser via `credentials: 'include'`. The Go
middleware (`AuthSession`) reads the cookie, resolves the Authula actor, and
materialises the local user projection. Public exceptions are system bootstrap,
password recovery, and guest-share link exchange/read routes; the latter routes
still require the app to be initialized. Guest reads use a separate expiring
HttpOnly capability cookie. Device authorization roles (`owner`, `editor`,
`viewer`) are separate from the global user role (`user` or `super_admin`).

**Note on `/api/auth/me`:** Authula's built-in `/me` route is bypassed by a
custom Fiber handler registered at the same path. The reason: Authula's session
plugin registers its `validateSessionHook` with `PluginID: "session.auth"`, which
only executes when the route's `Metadata["plugins"]` includes `"session.auth"`.
Authula's core routes carry no plugin metadata, so the hook never fires and the
route always 401s. The Fiber handler (`UsersHandler.Me`) reads the actor and
user already stored in Fiber locals by the `AuthSession` middleware and returns
the same `{ user: { id, email, name } }` shape the frontend expects.

## Response Format

```json
{
  "status_code": 200,
  "message": "devices retrieved",
  "data": [ ... ]
}
```

This envelope is used by the JSON application endpoints. Exceptions include
`GET /health`, the custom `/api/auth/me` projection, single-location ingestion
(empty `201` response), batch ingestion (its accepted/rejected result object),
SSE streams, and CSV/GPX file downloads.

## Database

22 migrations covering: extensions (`pgcrypto`, `pg_partman`, `pg_cron`), users, devices, user-device access (role-based: owner, editor, viewer), location time-series (monthly range partitions via pg_partman, `battery_voltage` + `signal_strength` telemetry, no `satellites`), device API keys (`X-Device-API-Key` opaque lookup tokens), password-reset tokens, temporary device share links, protection triggers, and `devices.last_contact_at` for presence.

Key decisions:
- **Soft deletes** on users, devices, access grants and API keys (`deleted_at`).
- **Append-only locations** — partitions dropped for retention, no deletes.
- **RESTRICT foreign keys** — no CASCADE.
- **Partial indexes** on hot query paths (`WHERE deleted_at IS NULL`).
- **IoT auth** uses a per-device, 32-byte random token carried in `X-Device-API-Key`. The token is returned only when created and the database's `key_hash` column stores the token directly (no bcrypt/hash-on-verify); at most one active key is allowed per device. Revoke the existing key before creating its replacement. See `docs/api/Authentication.md` for the threat model.

## Docker

```bash
docker build -t gps-tracker-api .
docker run -p 8080:8080 -e DATABASE_URL=postgres://user:pass@host:5432/gps_tracker?sslmode=disable gps-tracker-api
```
