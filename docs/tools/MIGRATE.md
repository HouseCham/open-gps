# Database Migrations

This project uses [golang-migrate](https://github.com/golang-migrate/migrate) for database migrations.

## Setup

Make sure `migrate` is installed and available in your PATH. See [README.md](./README.md) for installation instructions.

## Commands

### Apply all pending migrations
**Creates all new migration files that haven't been applied yet.**
```bash
migrate -path ../migrate/migrations -database "$DATABASE_URL" up
```

### Rollback the last migration
**Reverts the most recently applied migration.**
```bash
migrate -path ../migrate/migrations -database "$DATABASE_URL" down 1
```

### Check current migration version
**Shows the last applied migration version.**
```bash
migrate -path ../migrate/migrations -database "$DATABASE_URL" version
```

### Apply a specific number of migrations
**Runs `n` migrations forward.**
```bash
migrate -path ../migrate/migrations -database "$DATABASE_URL" up N
```

### Rollback a specific number of migrations
**Reverts `n` migrations.**
```bash
migrate -path ../migrate/migrations -database "$DATABASE_URL" down N
```

### Force a specific version
**Sets the migration version without running migrations (use with caution).**
```bash
migrate -path ../migrate/migrations -database "$DATABASE_URL" force VERSION
```

## Notes

- Each migration has an `up.sql` and `down.sql` file pair.
- `up.sql` applies the changes (e.g., add column).
- `down.sql` reverts the changes (e.g., drop column).
- Always run `down` before discarding a migration file.
