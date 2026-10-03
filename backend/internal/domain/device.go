package domain

import (
	"time"

	"github.com/google/uuid"
)

// Device represents a physical GPS tracking device registered in the system.
type Device struct {
	ID            uuid.UUID
	UuidFirmware  string
	Name          string
	VehicleType   DeviceVehicleType
	CreatedAt     time.Time
	LastContactAt *time.Time
}

// DeviceVehicleType categorises the asset the GPS is mounted on. The UI
// uses this value to render the right icon next to the device; the icon
// mapping itself lives in the frontend.
type DeviceVehicleType string

const (
	DeviceVehicleTypeBicycle    DeviceVehicleType = "bicycle"
	DeviceVehicleTypeMotorcycle DeviceVehicleType = "motorcycle"
	DeviceVehicleTypeCar        DeviceVehicleType = "car"
	DeviceVehicleTypeTruck      DeviceVehicleType = "truck"
	DeviceVehicleTypeVan        DeviceVehicleType = "van"
	DeviceVehicleTypeOther      DeviceVehicleType = "other"
)

// DeviceWithAccess pairs a Device with the AccessRole the requesting user has on it.
type DeviceWithAccess struct {
	Device
	AccessRole AccessRole
}

// AccessRole defines the permission level a user has on a device.
type AccessRole string

const (
	// AccessRoleOwner is the highest role, with full control over the device.
	AccessRoleOwner AccessRole = "owner"
	// AccessRoleEditor can modify device settings but cannot delete.
	AccessRoleEditor AccessRole = "editor"
	// AccessRoleViewer has read-only access to the device.
	AccessRoleViewer AccessRole = "viewer"
)
