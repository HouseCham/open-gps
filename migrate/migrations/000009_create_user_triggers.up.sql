-- super_admin immutability triggers. Combined with the partial unique index
-- from 000003, they guarantee: 1 super_admin, non-transferable, non-deletable.

CREATE OR REPLACE FUNCTION prevent_super_admin_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'super_admin role cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_super_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'super_admin' THEN
    RAISE EXCEPTION 'super_admin user cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_super_admin_role_change
BEFORE UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION prevent_super_admin_role_change();

CREATE TRIGGER trg_prevent_super_admin_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION prevent_super_admin_delete();
