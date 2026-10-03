-- Removes the cron job and partman config.
-- The locations table is dropped in 000006.
SELECT cron.unschedule('partman-maintenance-locations');
DELETE FROM part_config WHERE parent_table = 'public.locations';
