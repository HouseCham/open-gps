package handlers

import (
	"errors"
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"

	"github.com/HouseCham/gps-tracker/backend/internal/app/email"
	"github.com/HouseCham/gps-tracker/backend/internal/app/passwordreset"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
	"github.com/HouseCham/gps-tracker/backend/utils"
)

// PasswordResetHandler exposes the public password-recovery endpoints.
// Both routes are unauthenticated by design — a user who has lost
// their password cannot sign in to recover it.
type PasswordResetHandler struct {
	service *passwordreset.Service
}

func NewPasswordResetHandler(svc *passwordreset.Service) *PasswordResetHandler {
	return &PasswordResetHandler{service: svc}
}

// GenerateRecoveryToken handles POST /api/v1/auth/generate-pwd-recovery-token.
//
// Always responds 202 — successful dispatch, rate-limit hit, and
// unknown-email all look identical to the caller. This is the
// anti-enumeration contract: a malicious client cannot tell from the
// response whether the email exists in the system.
//
// Returns:
//   - 202 Accepted (always, on the happy path): `data.message_id`
//     echoes Resend's id when dispatch actually happened; the field
//     is omitted otherwise (rate-limited or unknown email).
//   - 400 when the body fails validation (e.g. malformed email,
//     locale not in {en, es}, missing reset_password_url).
//   - 502 when the upstream Resend call fails.
//   - 500 for any other terminal error.
func (h *PasswordResetHandler) GenerateRecoveryToken(c fiber.Ctx) error {
	const operation = "PasswordResetHandler:GenerateRecoveryToken"
	log.Debug(operation, "request received")

	req, ok := utils.GetValidatedBody[dto.GeneratePasswordRecoveryTokenRequest](c)
	if !ok {
		log.Error(operation, "err", fiber.ErrBadRequest, "reason", "invalid request body")
		return middleware.BadRequestResponse(c, "invalid request body")
	}

	res, err := h.service.Request(c.Context(), passwordreset.RequestInput{
		Email:    req.Email,
		Language: req.Locale,
		ResetURL: req.ResetPasswordURL,
		ClientIP: c.IP(),
	})
	if err != nil {
		if errors.Is(err, email.ErrInvalidLanguage) {
			log.Error(operation, "err", err, "locale", req.Locale)
			return middleware.BadRequestResponse(c, "invalid language")
		}
		log.Error(operation, "err", err, "to", req.Email)
		return c.Status(fiber.StatusBadGateway).JSON(response.HTTPResponse[bool]{
			StatusCode: fiber.StatusBadGateway,
			Message:    "upstream email provider failed",
		})
	}

	if res.Dispatched {
		log.Info(operation, "reset email dispatched", "messageID", res.MessageID, "to", req.Email)
	} else {
		// Anti-enumeration path: rate-limited or unknown email. Log at
		// debug level so production logs don't carry PII (the email).
		log.Debug(operation, "request silently dropped", "reason", "rate-limited or unknown email")
	}

	// 202 with or without a message_id — both cases intentionally look
	// the same to the client.
	payload := dto.GeneratePasswordRecoveryTokenResponse{MessageID: res.MessageID}
	if !res.Dispatched {
		payload.MessageID = ""
	}
	return c.Status(fiber.StatusAccepted).JSON(response.HTTPResponse[dto.GeneratePasswordRecoveryTokenResponse]{
		StatusCode: fiber.StatusAccepted,
		Message:    "password recovery token requested",
		Data:       payload,
	})
}

// ConsumeRecoveryToken handles POST /api/v1/auth/consume-pwd-recovery-token.
//
// Validates the token, rotates the user's password, and clears the
// must_change_password flag. The single error code (400 invalid/used/
// expired) is intentional: callers must not be able to distinguish
// between "token never existed", "token expired", and "token already
// used" — that would let an attacker probe token validity.
//
// Returns:
//   - 200 OK on success.
//   - 400 when the body fails validation OR when the token is
//     invalid/used/expired (the two are indistinguishable on the wire).
//   - 500 for any other terminal error.
func (h *PasswordResetHandler) ConsumeRecoveryToken(c fiber.Ctx) error {
	const operation = "PasswordResetHandler:ConsumeRecoveryToken"
	log.Debug(operation, "request received")

	req, ok := utils.GetValidatedBody[dto.ConsumePasswordRecoveryTokenRequest](c)
	if !ok {
		log.Error(operation, "err", fiber.ErrBadRequest, "reason", "invalid request body")
		return middleware.BadRequestResponse(c, "invalid request body")
	}

	if err := h.service.Consume(c.Context(), passwordreset.ConsumeInput{
		Token:       req.Token,
		NewPassword: req.NewPassword,
	}); err != nil {
		if errors.Is(err, passwordreset.ErrInvalidResetToken) {
			log.Debug(operation, "invalid reset token")
			return middleware.BadRequestResponse(c, "invalid or expired token")
		}
		log.Error(operation, "err", err)
		return fmt.Errorf("PasswordResetHandler.ConsumeRecoveryToken: %w", err)
	}

	log.Info(operation, "password reset consumed")
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[bool]{
		StatusCode: fiber.StatusOK,
		Message:    "password reset",
	})
}
