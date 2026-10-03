-- Align our `users` table with the columns Authula expects.
-- Authula's model queries `email_verified` and `image` and uses
-- `VARCHAR(255)` for `name`; our local table was missing those
-- columns and used VARCHAR(100), so any email-password sign-up
-- failed with "column email_verified does not exist" or
-- "value too long for type character varying(100)".
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN image TEXT;
ALTER TABLE users ALTER COLUMN name TYPE VARCHAR(255);
