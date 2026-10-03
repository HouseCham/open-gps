-- Add name and lastname columns to users table
ALTER TABLE users ADD COLUMN name varchar(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN lastname varchar(100) NOT NULL DEFAULT '';
