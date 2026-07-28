-- User role enum. Two values: 'user' (default) and 'super_admin'.
-- The first user to register is promoted to 'super_admin' by application logic.

CREATE TYPE user_role AS ENUM ('user', 'super_admin');
