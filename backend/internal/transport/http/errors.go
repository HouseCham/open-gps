package http

import (
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/HouseCham/gps-tracker/backend/internal/app/devices"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
)

// httpErrorHandler maps domain errors to HTTP status codes
func httpErrorHandler(c fiber.Ctx, err error) error {
	status, message := mapDomainError(err)
	return c.Status(status).JSON(response.HTTPResponse[struct{}]{
		StatusCode: status,
		Message:    message,
	})
}

// mapDomainError maps domain errors to HTTP status codes
func mapDomainError(err error) (status int, message string) {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		return fe.Code, fe.Message
	}

	switch {
	case errors.Is(err, domain.ErrNotFound):
		return fiber.StatusNotFound, "resource not found"
	case errors.Is(err, domain.ErrUnauthorized):
		return fiber.StatusUnauthorized, "unauthorized"
	case errors.Is(err, domain.ErrForbidden):
		return fiber.StatusForbidden, "forbidden"
	case errors.Is(err, domain.ErrCannotRevokeSelf):
		return fiber.StatusBadRequest, "cannot revoke your own device access"
	case errors.Is(err, domain.ErrConflict):
		return fiber.StatusConflict, "conflict"
	case errors.Is(err, domain.ErrValidation):
		return fiber.StatusBadRequest, "validation error"
	case errors.Is(err, domain.ErrMustChangePassword):
		return fiber.StatusForbidden, "must change password"
	case errors.Is(err, domain.ErrDeviceLimitReached):
		return fiber.StatusForbidden, fmt.Sprintf("device limit reached (max %d devices per user)", devices.MaxDevicesPerUser)
	}

	return fiber.StatusInternalServerError, "internal server error"
}
