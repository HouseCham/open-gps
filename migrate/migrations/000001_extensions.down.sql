-- Order: pg_cron depends on nothing. pg_partman uses pgcrypto. pgcrypto depends on nothing.
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_partman CASCADE;
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
