package handlers

import (
	"errors"
	"fmt"
	"net"
	"strings"

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
// Always responds 202 with the same body — successful dispatch,
// rate-limit hit, unknown email and upstream email failure all look
// identical to the caller. This is the anti-enumeration contract: a
// malicious client cannot tell from the response whether the email
// exists in the system. The reset link destination is built
// server-side from the configured public origin; the request cannot
// influence it.
//
// Returns:
//   - 202 Accepted on every path: the body carries no dispatch
//     metadata (Resend's message id stays in server logs only).
//   - 400 when the body fails validation (e.g. malformed email or
//     locale not in {en, es}).
//   - 502 for any other terminal error (DB, token store, etc.).
func (h *PasswordResetHandler) GenerateRecoveryToken(c fiber.Ctx) error {
	const operation = "PasswordResetHandler:GenerateRecoveryToken"
	log.Debug(operation, "request received")

	req, ok := utils.GetValidatedBody[dto.GeneratePasswordRecoveryTokenRequest](c)
	if !ok {
		log.Error(operation, "err", fiber.ErrBadRequest, "reason", "invalid request body")
		return middleware.BadRequestResponse(c, "invalid request body")
	}
	clientIP, err := passwordRecoveryClientIP(c)
	if err != nil {
		// Resolve the client identity before looking up the email. This
		// failure is consequently independent of whether the account exists.
		log.Error(operation, "err", err, "reason", "trusted client IP unavailable")
		return c.Status(fiber.StatusServiceUnavailable).JSON(response.HTTPResponse[bool]{
			StatusCode: fiber.StatusServiceUnavailable,
			Message:    "password recovery temporarily unavailable",
		})
	}

	res, err := h.service.Request(c.Context(), passwordreset.RequestInput{
		Email:    req.Email,
		Language: req.Locale,
		ClientIP: clientIP,
	})
	if err != nil {
		if errors.Is(err, passwordreset.ErrClientIPRequired) {
			log.Error(operation, "err", err, "reason", "trusted client IP unavailable")
			return c.Status(fiber.StatusServiceUnavailable).JSON(response.HTTPResponse[bool]{
				StatusCode: fiber.StatusServiceUnavailable,
				Message:    "password recovery temporarily unavailable",
			})
		}
		if errors.Is(err, email.ErrInvalidLanguage) {
			log.Error(operation, "err", err, "locale", req.Locale)
			return middleware.BadRequestResponse(c, "invalid language")
		}
		if errors.Is(err, passwordreset.ErrEmailDispatch) {
			// Upstream email failed for a known address. Answer the
			// same 202 as every other path — a distinct status would
			// be an account-enumeration oracle.
			log.Error(operation, "err", err, "to", req.Email)
			return acceptedRecoveryResponse(c)
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

	return acceptedRecoveryResponse(c)
}

// passwordRecoveryClientIP returns the normalized address that the trusted
// reverse proxy supplied. Direct requests from untrusted peers use Fiber's
// TCP peer address; a trusted proxy missing X-Real-IP fails closed.
func passwordRecoveryClientIP(c fiber.Ctx) (string, error) {
	raw := c.IP()
	if c.IsProxyTrusted() {
		raw = c.Get("X-Real-IP")
	}
	ip := net.ParseIP(strings.TrimSpace(raw))
	if ip == nil {
		return "", fmt.Errorf("invalid client IP %q", raw)
	}
	return ip.String(), nil
}

// acceptedRecoveryResponse is the single wire answer for every
// generate-token path. Extracted so the dispatched, dropped and
// email-failure branches cannot drift into different bodies.
func acceptedRecoveryResponse(c fiber.Ctx) error {
	return c.Status(fiber.StatusAccepted).JSON(response.HTTPResponse[bool]{
		StatusCode: fiber.StatusAccepted,
		Message:    "password recovery token requested",
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
