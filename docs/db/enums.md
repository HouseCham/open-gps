# Custom Enum Types

## device_vehicle_type

Defined in migration `000013_add_device_vehicle_type.up.sql`.

```sql
CREATE TYPE device_vehicle_type AS ENUM ('bicycle', 'motorcycle', 'car', 'truck', 'van', 'other');
```

| Value | Description |
|-------|-------------|
| `bicycle` | Pedal bicycle |
| `motorcycle` | Motorbike / scooter |
| `car` | Standard passenger car |
| `truck` | Commercial truck / lorry |
| `van` | Van / light commercial vehicle |
| `other` | Default for existing devices and unspecified vehicle types |

### Usage

Used as the `vehicle_type` column type in the `devices` table. The frontend maps this value to an icon. The Go mapping is:

```go
type DeviceVehicleType string

const (
    DeviceVehicleTypeBicycle    DeviceVehicleType = "bicycle"
    DeviceVehicleTypeMotorcycle DeviceVehicleType = "motorcycle"
    DeviceVehicleTypeCar        DeviceVehicleType = "car"
    DeviceVehicleTypeTruck      DeviceVehicleType = "truck"
    DeviceVehicleTypeVan        DeviceVehicleType = "van"
    DeviceVehicleTypeOther     DeviceVehicleType = "other"
)
```

All new devices must specify a `vehicle_type` at creation time. Existing devices default to `'other'`.

---

## user_role

Defined in migration `000002_create_user_role_enum.up.sql`.

```sql
CREATE TYPE user_role AS ENUM ('user', 'super_admin');
```

| Value | Description |
|-------|-------------|
| `user` | Standard user — can access own devices and profile. Default for all new users. |
| `super_admin` | Administrator — can manage all users and devices. Unique (only one allowed). |

### Usage

Used as the `role` column type in the `users` table. The Go mapping is:

```go
type UserRole string

const (
    UserRoleUser       UserRole = "user"
    UserRoleSuperAdmin UserRole = "super_admin"
)
```

### Enforcement

Two additional safeguards protect the `super_admin` role at the database level:

1. **Partial unique index** (`idx_users_one_super_admin`): ensures at most one row has `role = 'super_admin'`.
2. **PL/pgSQL triggers** (migration 000009): prevent changing a `super_admin`'s role or deleting the `super_admin` row.

### Design Rationale

The system needs a single administrator account for managing users and devices while keeping the role model simple. The `super_admin` role is designed to be:
- **Immutable** — once assigned, it cannot be transferred or removed
- **Non-deletable** — the `super_admin` user cannot be soft-deleted
- **Unique** — only one `super_admin` exists at any time

The first user to register is promoted to `super_admin` by application logic in the `LazyUser` middleware.
