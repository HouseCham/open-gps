# GPS Tracker

A self-hosted, open-source web application for real-time GPS tracking of IoT devices via cellular connectivity (ESP32 + SIM7080G). Target audience: hobbyists, small businesses, and developers who want full control over their tracking data.

## Architecture

```
                         ┌──────────────────┐
iot/     →  backend/  →  │ nginx (reverse   │  →  browser
(ESP32 +     (Go)        │ proxy + TLS)     │      https://localhost
SIM7080G)                │                  │
                         └──────────────────┘
                                 ↑
                           frontend/
                           (Astro + React, static)
```

In local development, every component — the Astro SPA, the Go API, and Authula's auth routes — sits behind a single nginx reverse proxy on `https://localhost`. This keeps the http-only `authula.session_token` cookie on the same origin as the SPA, so the browser sends it on API calls without any cross-origin dance. See `nginx/README.md` for routing details.

### IoT Layer
- **ESP32** microcontrollers with **SIM7080G** LTE/NB-IoT modules report GPS coordinates over the cellular network.

### Backend (`backend/`)
- **Go** API built with **Fiber v3**, following **Hexagonal Architecture** (Ports & Adapters).
- Domain-driven layering: `domain/` → `app/` → `infra/postgres/` + `transport/http/`.
- **PostgreSQL 16** with time-series location data partitioned monthly (pg_partman), append-only, 12-month retention.
- Role-based access control: `owner`, `editor`, `viewer`, `super_admin`.
- Soft deletes on users, devices, access grants, and API keys.

### Frontend (`frontend/`)
- **Astro 6** + **React 19** (Islands Architecture).
- Pure CSS design system (no Tailwind, no CSS-in-JS).
- **Authula** for authentication (HTTP-only session cookie), Nano Stores for shared client state.
- Multi-language support (English / Spanish).
- i18n routing (`/[lan]/`).

### Infrastructure
- **Docker Compose** for local development: PostgreSQL, migrations, API, frontend, and the nginx reverse proxy.
- **nginx** routes traffic between the SPA, API, and Authula on a single origin (`https://localhost`); TLS is self-signed locally and terminated by Traefik in production.
- Real-time location updates via server-sent events (SSE), streamed same-origin and keeping the session cookie (single API instance required).

## Tech Stack

| Layer | Technology |
|---|---|
| IoT | ESP32, SIM7080G (LTE/NB-IoT) |
| Backend | Go 1.26, Fiber v3, pgx/v5, sqlc |
| Frontend | Astro 6.4, React 19, TypeScript |
| Database | PostgreSQL 16, pg_partman, pg_cron |
| Auth | Session cookie (Authula), better-fetch/fetch |
| Reverse proxy | nginx (routing + static; TLS local, Traefik in production) |
| Infrastructure | Docker Compose |

## Data Model

- **Users** own or are granted access to **Devices**
- **Devices** report GPS **Locations** (immutable, append-only time-series)
- Devices expose a **presence state** (`online_moving`, `online_stationary`, `offline`, `never_seen`) derived by the server from `last_contact_at`
- **API Keys** per device (single active key, raw token stored in `key_hash`) for IoT ingestion
- Locations partitioned by month, automatically dropped after 12 months

## Getting Started

```bash
# 1. Configure environment
cp .env.example .env

# 2. Generate the local TLS cert (one-time, gitignored)
./scripts/generate-certs.sh

# 3. Boot the full stack (COMPOSE_FILE in .env pulls in the local override)
docker compose up -d
```

Then visit `https://localhost`. The browser will warn about the self-signed cert on the first visit — accept the exception. See `nginx/README.md` for using `mkcert` to silence the warning permanently.

`make run` boots the same stack but starts with `down -v` — use it to wipe all data and start fresh.

## Documentation

- Component guides: [`backend/`](backend/README.md), [`frontend/`](frontend/README.md), [`nginx/`](nginx/README.md), [`iot/`](iot/README.md), [`migrate/`](migrate/README.md)
- `docs/api/` — HTTP API reference (auth, devices, locations, reports, users, API keys, email, password recovery)
- `docs/db/` — schema, indexes, enums, triggers
- `docs/tools/MIGRATE.md` — migration workflow

API and frontend services are not exposed directly — all traffic goes through nginx.
