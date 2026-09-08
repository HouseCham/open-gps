# GPS Tracker

A self-hosted, open-source web application for real-time GPS tracking of IoT devices via cellular connectivity (ESP32 + SIM7080G). Target audience: hobbyists, small businesses, and developers who want full control over their tracking data.

## Architecture

```
                        ┌──────────────────┐
iot/        →  api/  →  │ nginx (reverse   │  →  browser
(ESP32 +        (Go)    │ proxy + TLS)     │      https://localhost
SIM7080G)               │                  │
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
- Soft deletes on users, devices, and API keys.

### Frontend (`frontend/`)
- **Astro 6** + **React 19** (Islands Architecture).
- Pure CSS design system (no Tailwind, no CSS-in-JS).
- `better-auth` for authentication, Nano Stores for shared client state.
- Multi-language support (English / Spanish).
- i18n routing (`/[lan]/`).

### Infrastructure
- **Docker Compose** for local development: PostgreSQL, migrations, API, frontend, and the nginx reverse proxy.
- **nginx** terminates TLS and routes traffic between the SPA, API, and Authula on a single origin (`https://localhost`).
- Real-time location updates via server-sent events (SSE), streamed same-origin and keeping the session cookie (single API instance required).

## Tech Stack

| Layer | Technology |
|---|---|
| IoT | ESP32, SIM7080G (LTE/NB-IoT) |
| Backend | Go 1.26, Fiber v3, pgx/v5, sqlc |
| Frontend | Astro 6.4, React 19, TypeScript |
| Database | PostgreSQL 16, pg_partman, pg_cron |
| Auth | Session cookie (Authula), better-fetch/fetch |
| Reverse proxy | nginx (TLS termination, static file serving) |
| Infrastructure | Docker Compose |

## Data Model

- **Users** own or are granted access to **Devices**
- **Devices** report GPS **Locations** (immutable, append-only time-series)
- Devices expose a **presence state** (`online_moving`, `online_stationary`, `offline`, `never_seen`) derived by the server from `last_contact_at`
- **API Keys** per device (bcrypt-hashed) for IoT ingestion
- Locations partitioned by month, automatically dropped after 12 months

## Getting Started

```bash
# 1. Configure environment
cp .env.example .env

# 2. Generate the local TLS cert (one-time, gitignored)
./scripts/generate-certs.sh

# 3. Boot the full stack
docker compose up -d
```

Then visit `https://localhost`. The browser will warn about the self-signed cert on the first visit — accept the exception. See `nginx/README.md` for using `mkcert` to silence the warning permanently.

API and frontend services are not exposed directly — all traffic goes through nginx. See `backend/README.md` and `frontend/README.md` for layer-specific details.
