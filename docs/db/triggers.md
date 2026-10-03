# Triggers & Functions

Defined in migration `000009_create_user_triggers.up.sql`.

## prevent_super_admin_role_change

Prevents changing the `role` of a `super_admin` user to any other value.

```sql
CREATE OR REPLACE FUNCTION prevent_super_admin_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'super_admin role cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_super_admin_role_change
BEFORE UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION prevent_super_admin_role_change();
```

- **Event**: `BEFORE UPDATE OF role ON users`
- **Scope**: Every row whose `role` column is being modified
- **Behavior**: If the existing role is `super_admin` and the new role is different, raises an exception

## prevent_super_admin_delete

Prevents deleting the `super_admin` user row.

```sql
CREATE OR REPLACE FUNCTION prevent_super_admin_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'super_admin' THEN
    RAISE EXCEPTION 'super_admin user cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_super_admin_delete
BEFORE DELETE ON users
FOR EACH ROW EXECUTE FUNCTION prevent_super_admin_delete();
```

- **Event**: `BEFORE DELETE ON users`
- **Scope**: Every row being deleted
- **Behavior**: If the row's role is `super_admin`, raises an exception

## Super Admin Guarantees

Together with the partial unique index `idx_users_one_super_admin` from migration 000003, these triggers provide three guarantees:

| Guarantee | Mechanism |
|-----------|-----------|
| Only one `super_admin` exists | Partial unique index `ON users (role) WHERE role = 'super_admin'` |
| `super_admin` role cannot be changed | Trigger `trg_prevent_super_admin_role_change` |
| `super_admin` cannot be deleted | Trigger `trg_prevent_super_admin_delete` |

This protects the administrative account from accidental or malicious role changes, deletion, or creation of additional super-admin accounts.
