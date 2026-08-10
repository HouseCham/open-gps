# PostgreSQL Extensions

Defined in migration `000001_extensions.up.sql`.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_partman;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

## pgcrypto

Provides cryptographic functions, primarily `gen_random_uuid()` for UUID primary key generation.

- **Used by**: All tables use `DEFAULT gen_random_uuid()` for their `id` columns
- **Documentation**: [pgcrypto — PostgreSQL documentation](https://www.postgresql.org/docs/current/pgcrypto.html)

## pg_partman

Automated partition management for the `locations` table.

Configuration (migration 000007):

```sql
SELECT create_parent(
  p_parent_table := 'public.locations',
  p_control      := 'recorded_at',
  p_type         := 'range',
  p_interval     := '1 month',
  p_premake      := 4
);

UPDATE part_config
SET retention            = '12 months',
    retention_keep_table = false
WHERE parent_table = 'public.locations';
```

| Setting | Value | Description |
|---------|-------|-------------|
| Partition type | `range` | Monthly date-range partitions |
| Partition key | `recorded_at` | Timestamptz column |
| Premake | 4 | Keep 4 future partitions ready |
| Retention | 12 months | Drop partitions older than 12 months |
| Keep table on retention | `false` | Drop old partitions (not detach) |

**Important**: pg_partman v5 installs its tables (`part_config`) and functions (`create_parent`, `run_maintenance`) in the `public` schema, not in a `partman` schema. This is a breaking change from v4.

## pg_cron

Job scheduler for periodic partition maintenance.

Schedule (migration 000007):

```sql
SELECT cron.schedule(
  'partman-maintenance-locations',
  '0 3 * * *',
  $$SELECT run_maintenance('public.locations')$$
);
```

| Setting | Value |
|---------|-------|
| Job name | `partman-maintenance-locations` |
| Schedule | Daily at 03:00 UTC |
| Command | `SELECT run_maintenance('public.locations')` |

`run_maintenance()` performs two operations:
1. Creates the next month's partition (if needed)
2. Drops partitions that exceed the 12-month retention period

## Requirements

- These extensions require PostgreSQL superuser privileges
- `pg_partman` must be installed on the PostgreSQL server (available via apt, pgxn, or from source: [pg_partman](https://github.com/pgpartman/pg_partman))
- The `gps_user` role is granted superuser in development for simplicity
