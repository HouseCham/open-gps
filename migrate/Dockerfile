# Dockerfile for running database migrations in production.
#
# Wraps the official migrate/migrate image with the project's migration
# files baked in. The ENTRYPOINT bakes in the migrations path so callers
# only need to pass the database URL and the subcommand.
#
# Usage (one-shot):
#   docker run --rm chamito/open-gps-migrate:dev \
#     -database "postgres://USER:PASS@HOST:5432/DB?sslmode=disable" \
#     up
#
# Other subcommands work the same way: `down 1`, `version`, `force 14`.

FROM migrate/migrate:v4.17.0

COPY migrations /migrations

ENTRYPOINT ["migrate", "-path", "/migrations"]