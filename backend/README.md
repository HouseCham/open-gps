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

```
GET  /health

# Auth routes (Authula + custom /me handler on Fiber)
POST   /api/auth/email-password/sign-in
POST   /api/auth/email-password/sign-up
POST   /api/auth/sign-out
GET    /api/auth/oauth2/authorize/:provider
GET    /api/auth/oauth2/callback/:provider
GET    /api/auth/me                    (custom Fiber handler — see note below)

# App routes
GET    /api/v1/devices
GET    /api/v1/devices/:id
POST   /api/v1/devices
PUT    /api/v1/devices/:id             (requires editor role)
DELETE /api/v1/devices/:id             (requires owner role)
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users                   (requires super_admin role)
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id              (requires super_admin role)
POST   /api/v1/auth/change-password
GET    /api/v1/system/bootstrap
```

### Authentication

All `/api/v1/*` routes require an active session cookie (`authula.session_token`).
The cookie is set by Authula on sign-in / sign-up and sent automatically by the
browser via `credentials: 'include'`. The Go middleware (`AuthSession`) reads the
cookie, resolves the Authula actor, and materialises the local user projection.

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

## Database

16 migration files covering: extensions (`pgcrypto`, `pg_partman`, `pg_cron`), users, devices, user-device access (role-based: owner, editor, viewer), location time-series (monthly range partitions via pg_partman, `battery_voltage` + `signal_strength` telemetry, no `satellites`), device API keys (`X-Device-API-Key` lookup tokens — opaque, not bcrypt), and protection triggers.

Key decisions:
- **Soft deletes** on users, devices, access grants and API keys (`deleted_at`).
- **Append-only locations** — partitions dropped for retention, no deletes.
- **RESTRICT foreign keys** — no CASCADE.
- **Partial indexes** on hot query paths (`WHERE deleted_at IS NULL`).
- **IoT auth** uses per-device opaque tokens carried in the `X-Device-API-Key` header. See `docs/api/Authentication.md` for the threat model and the rationale for storing tokens in cleartext (no bcrypt per verify).

## Docker

```bash
docker build -t gps-tracker-api .
docker run -p 8080:8080 -e DATABASE_URL=postgres://user:pass@host:5432/gps_tracker?sslmode=disable gps-tracker-api
```
