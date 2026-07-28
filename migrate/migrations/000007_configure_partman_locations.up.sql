-- Configures pg_partman for locations: monthly range, daily maintenance at 03:00.
-- IMPORTANT: pg_partman v5 installs the tables (part_config) and functions
-- (create_parent, run_maintenance) in the PUBLIC schema, NOT in a 'partman'
-- schema. This is a breaking change from v4.

-- Registers the parent table with pg_partman. p_premake = 4 creates 4 future
-- partitions in advance (4 months ahead).
SELECT create_parent(
  p_parent_table := 'public.locations',
  p_control      := 'recorded_at',
  p_type         := 'range',
  p_interval     := '1 month',
  p_premake      := 4
);

-- Retention: 12 months. Oldest partitions are dropped automatically
-- (DROP TABLE, instant) once they exceed retention.
UPDATE part_config
SET retention            = '12 months',
    retention_keep_table = false
WHERE parent_table = 'public.locations';

-- Daily job at 03:00 (UTC) that calls run_maintenance().
-- run_maintenance creates the next month's partition and drops old ones.
SELECT cron.schedule(
  'partman-maintenance-locations',
  '0 3 * * *',
  $$SELECT run_maintenance('public.locations')$$
);
