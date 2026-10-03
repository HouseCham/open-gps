package dto

import (
	"time"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type DeviceResponse struct {
	ID            string                   `json:"id"`
	UuidFirmware  string                   `json:"uuid_firmware"`
	Name          string                   `json:"name"`
	VehicleType   domain.DeviceVehicleType `json:"vehicle_type"`
	CreatedAt     time.Time                `json:"created_at"`
	LastContactAt *time.Time               `json:"last_contact_at,omitempty"`
}

type CreateDeviceRequest struct {
	UuidFirmware string `json:"uuid_firmware" validate:"required,uuid"`
	Name         string `json:"name"          validate:"required,min=1,max=255"`
	VehicleType  string `json:"vehicle_type"  validate:"required,oneof=bicycle motorcycle car truck van other"`
}

type UpdateDeviceRequest struct {
	Name        string `json:"name"         validate:"required,min=1,max=255"`
	VehicleType string `json:"vehicle_type" validate:"omitempty,oneof=bicycle motorcycle car truck van other"`
}

type DeviceWithAccessResponse struct {
	DeviceResponse
	AccessRole string `json:"access_role"`
}

// DeviceDetailResponse is the body of GET /api/v1/devices/:id. It pairs the
// caller's view of the device (including their own access role) with the list
// of every user that currently has access to it, so the frontend can render
// the access-management panel without a second round-trip.
type DeviceDetailResponse struct {
	DeviceWithAccessResponse
	Users []UserAccessOnDeviceResponse `json:"users"`
}

type DeviceListResponse struct {
	Items      []DeviceWithAccessResponse `json:"items"`
	Pagination PaginationMeta             `json:"pagination"`
}

// DeviceCountResponse is the body of GET /api/v1/devices/count.
// Carries only the total count of devices the caller has access to so
// callers that don't need the full list (e.g. the profile page) avoid
// fetching every row + their access role.
type DeviceCountResponse struct {
	Total int `json:"total"`
}

// DeviceFromDomain converts a *domain.Device to a DeviceResponse
func DeviceFromDomain(d *domain.Device) DeviceResponse {
	return DeviceResponse{
		ID:            d.ID.String(),
		UuidFirmware:  d.UuidFirmware,
		Name:          d.Name,
		VehicleType:   d.VehicleType,
		CreatedAt:     d.CreatedAt,
		LastContactAt: d.LastContactAt,
	}
}

// DeviceWithAccessFromDomain converts a *domain.DeviceWithAccess to a DeviceWithAccessResponse
func DeviceWithAccessFromDomain(d *domain.DeviceWithAccess) DeviceWithAccessResponse {
	return DeviceWithAccessResponse{
		DeviceResponse: DeviceFromDomain(&d.Device),
		AccessRole:     string(d.AccessRole),
	}
}

// DeviceDetailFromDomain converts a *domain.DeviceWithAccess and the list of
// users that have access to it into a DeviceDetailResponse. When `users` is
// nil (caller is not the owner) the response includes an empty array rather
// than omitting the field, so the frontend can always render a list.
func DeviceDetailFromDomain(d *domain.DeviceWithAccess, users []domain.UserWithAccessOnDevice) DeviceDetailResponse {
	userDTOs := make([]UserAccessOnDeviceResponse, 0, len(users))
	for _, u := range users {
		userDTOs = append(userDTOs, UserAccessOnDeviceResponse{
			UserID:          u.UserID.String(),
			Name:            u.Name,
			Email:           u.Email,
			Role:            string(u.AccessRole),
			AccessGrantedAt: u.AccessGrantedAt,
		})
	}
	return DeviceDetailResponse{
		DeviceWithAccessResponse: DeviceWithAccessFromDomain(d),
		Users:                    userDTOs,
	}
}
