DROP TRIGGER IF EXISTS trg_prevent_super_admin_delete ON users;
DROP TRIGGER IF EXISTS trg_prevent_super_admin_role_change ON users;
DROP FUNCTION IF EXISTS prevent_super_admin_delete();
DROP FUNCTION IF EXISTS prevent_super_admin_role_change();
