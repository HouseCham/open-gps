-- Enables the extensions required by the project.
-- pgcrypto: gen_random_uuid() for PKs
-- pg_partman: automatic partition management for locations
-- pg_cron: scheduler to run partman.run_maintenance() daily
-- (requires the user to be SUPERUSER; gps_user is in dev)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_partman;
CREATE EXTENSION IF NOT EXISTS pg_cron;
