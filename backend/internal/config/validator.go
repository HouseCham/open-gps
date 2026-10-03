package config

import (
	"fmt"
	"time"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
)

// SetUpValidator builds a *validator.Validate with the custom validations
// registered for gps-tracker. The returned instance is meant to be created
// once at startup and reused.
func SetUpValidator() *validator.Validate {
	v := validator.New()
	v.RegisterValidation("uuid", validateUUID)
	v.RegisterValidation("access_role", validateAccessRole)
	v.RegisterValidation("user_role", validateUserRole)
	v.RegisterValidation("rfc3339", validateRFC3339)
	return v
}

// GetValidatorErrorMessage converts a validator.ValidationErrors into the
// project's wire format ([]domain.ValidatorError), with human-readable messages.
func GetValidatorErrorMessage(err error) []domain.ValidatorError {
	var errors []domain.ValidatorError
	vErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		return errors
	}
	for _, vErr := range vErrs {
		errors = append(errors, domain.ValidatorError{
			Tag:   vErr.Tag(),
			Field: vErr.Field(),
			Err:   fmt.Sprintf(errorMessages[vErr.Tag()], validationFields[vErr.Field()]),
		})
	}
	return errors
}

// errorMessages is the map of validation tag -> human-readable message template.
// The %s placeholder is replaced with the field's human name.
var errorMessages = map[string]string{
	"required":    "The field %s is required.",
	"uuid":        "The field %s must be a valid UUID.",
	"access_role": "The field %s must be one of: owner, editor, viewer.",
	"user_role":   "The field %s must be one of: user, super_admin.",
	"email":       "The field %s must be a valid email address.",
	"max":         "The field %s exceeds the maximum length of characters allowed.",
	"min":         "The field %s is below the minimum length of characters allowed.",
	"len":         "The field %s must have exactly the specified length.",
	"gte":         "The field %s must be greater than or equal to the specified value.",
	"lte":         "The field %s must be less than or equal to the specified value.",
	"rfc3339":     "The field %s must be a valid ISO 8601 / RFC 3339 timestamp.",
	"datetime":    "The field %s must be a valid timestamp.",
}

// validationFields maps Go struct field names to their human-readable label
// used in error messages.
var validationFields = map[string]string{
	/* ===== User ===== */
	"ID":        "id",
	"Email":     "email",
	"Role":      "role",
	"CreatedAt": "created at",
	"UpdatedAt": "updated at",

	/* ===== Device ===== */
	"UuidFirmware":  "firmware uuid",
	"Name":          "name",
	"LastContactAt": "last contact at",

	/* ===== Access ===== */
	"UserID":   "user id",
	"DeviceID": "device id",
	"OwnerID":  "owner id",

	/* ===== Location ===== */
	"RecordedAt":     "recorded at",
	"Latitude":       "latitude",
	"Longitude":      "longitude",
	"Altitude":       "altitude",
	"Speed":          "speed",
	"Accuracy":       "accuracy",
	"BatteryVoltage": "battery voltage",
	"SignalStrength": "signal strength",
}

// validateUUID checks that the field is a syntactically valid UUID.
// Empty strings are considered valid here so the `required` tag can catch them.
func validateUUID(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	if s == "" {
		return true
	}
	_, err := uuid.Parse(s)
	return err == nil
}

// validateAccessRole checks that the field is one of the allowed device
// access roles: owner, editor, viewer.
func validateAccessRole(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	if s == "" {
		return true
	}
	switch s {
	case "owner", "editor", "viewer":
		return true
	}
	return false
}

// validateUserRole checks that the field is one of the allowed user roles:
// user, super_admin.
func validateUserRole(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	if s == "" {
		return true
	}
	switch s {
	case "user", "super_admin":
		return true
	}
	return false
}

// validateRFC3339 checks that the field is parseable as RFC 3339
// (the ISO 8601 profile Go's time package accepts). Used on the
// `recorded_at` field of the location-ingest DTO so the ESP32 can
// send any well-formed UTC instant without us hard-coding a specific
// format.
func validateRFC3339(fl validator.FieldLevel) bool {
	s := fl.Field().String()
	if s == "" {
		return true
	}
	_, err := time.Parse(time.RFC3339, s)
	return err == nil
}
