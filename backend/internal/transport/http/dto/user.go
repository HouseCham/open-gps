package dto

import (
	"time"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type UserResponse struct {
	ID                 string    `json:"id"`
	Email              string    `json:"email"`
	EmailVerified      bool      `json:"email_verified"`
	Image              *string   `json:"image,omitempty"`
	Name               string    `json:"name"`
	Lastname           string    `json:"lastname"`
	Role               string    `json:"role"`
	MustChangePassword bool      `json:"must_change_password"`
	CreatedAt          time.Time `json:"created_at"`
}

func UserFromDomain(u *domain.User) UserResponse {
	return UserResponse{
		ID:                 u.ID.String(),
		Email:              u.Email,
		EmailVerified:      u.EmailVerified,
		Image:              u.Image,
		Name:               u.Name,
		Lastname:           u.Lastname,
		Role:               string(u.Role),
		MustChangePassword: u.MustChangePassword,
		CreatedAt:          u.CreatedAt,
	}
}

type CreateUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Name     string `json:"name" validate:"required,min=1,max=100"`
	Lastname string `json:"lastname" validate:"omitempty,min=0,max=100"`
}

type CreateUserResponse struct {
	UserResponse
	TemporaryPassword string `json:"temporary_password"`
}

func CreateUserResponseFromDomain(u *domain.User, temporaryPassword string) CreateUserResponse {
	return CreateUserResponse{
		UserResponse:      UserFromDomain(u),
		TemporaryPassword: temporaryPassword,
	}
}

type UpdateUserRequest struct {
	Name     string `json:"name" validate:"omitempty,min=0,max=100"`
	Lastname string `json:"lastname" validate:"omitempty,min=0,max=100"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" validate:"required,min=1"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

type DeviceBasicResponse struct {
	ID           string `json:"id"`
	UuidFirmware string `json:"uuid_firmware"`
	Name         string `json:"name"`
}

type PaginationMeta struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	Total      int `json:"total"`
	TotalPages int `json:"total_pages"`
}

type UserWithDevicesResponse struct {
	UserResponse
	Devices    []DeviceBasicResponse `json:"devices"`
	Pagination PaginationMeta        `json:"pagination"`
}

func DeviceBasicFromDomain(d *domain.Device) DeviceBasicResponse {
	return DeviceBasicResponse{
		ID:           d.ID.String(),
		UuidFirmware: d.UuidFirmware,
		Name:         d.Name,
	}
}
