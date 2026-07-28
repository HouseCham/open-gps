# migrate/

Self-contained, one-shot Docker image for running database migrations in
production. Wraps the official [`migrate/migrate`](https://github.com/golang-migrate/migrate)
binary with the project's SQL migration files baked in.

## Why a separate image

The Go API does not own the migration files at runtime — `golang-migrate`
does. Decoupling `migrate/` from `backend/` lets production run migrations
in a one-shot container that does not depend on the API image, and lets
newcomers see "this is how migrations get applied" without reading the
backend codebase.

## Layout

```
migrate/
├── Dockerfile         # FROM migrate/migrate, COPY migrations
├── README.md          # this file
└── migrations/        # *.up.sql / *.down.sql (was backend/migrations/)
```

The `migrations/` directory was moved from `backend/migrations/` so the
migration tool owns its own input. The backend no longer ships migrations
in its image.

## Build & push

```bash
docker build -t chamito/open-gps-migrate:dev ./migrate
docker push  chamito/open-gps-migrate:dev
```

Push only when migration files change. The image is tiny (~20 MB on top
of the base) and rebuilds in seconds.

## Run locally (against the docker-compose stack)

The `docker-compose.local.yml` already wires this image into the `migrate`
service. Migrations run automatically before the API starts:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up
```

## Run in production (one-shot)

Against any reachable Postgres — Dokploy's internal DB host, a managed
Postgres, or the public endpoint:

```bash
docker run --rm chamito/open-gps-migrate:dev \
  -path /migrations \
  -database "postgres://USER:PASS@HOST:5432/DB?sslmode=disable" \
  up
```

Useful subcommands:

| Command | Effect |
|---|---|
| `up` | Apply all pending migrations |
| `up N` | Apply the next `N` pending migrations |
| `down 1` | Revert the most recent migration |
| `version` | Print current schema version (no writes) |
| `force VERSION` | Set the version without running migrations (recovery only) |

## Authoring a new migration

1. Add `NNNNNN_name.up.sql` and `NNNNNN_name.down.sql` under `migrate/migrations/`.
   Numbering is sequential — find the highest existing number and add one.
2. The down migration must reverse the up migration completely.
3. Run `sqlc generate` from `backend/` if the migration introduces or
   changes tables used by typed queries (see `backend/sqlc.yaml`).
4. Build & push a new `migrate` image so production can pick up the
   change.

## Adding new migration files from `backend/`

`sqlc` reads migrations from `migrate/migrations/` via the
`schema: "../migrate/migrations"` path in `backend/sqlc.yaml`. Keep
that path in sync if the layout ever changes again.