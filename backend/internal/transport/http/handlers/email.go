package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"

	"github.com/HouseCham/gps-tracker/backend/internal/app/email"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
	"github.com/HouseCham/gps-tracker/backend/utils"
)

type EmailHandler struct {
	service *email.Service
}

func NewEmailHandler(svc *email.Service) *EmailHandler {
	return &EmailHandler{service: svc}
}

// SendWelcome handles POST /api/v1/email/welcome.
// Dispatches the welcome email through Resend using the template
// (EN or ES) the client passes in `locale`. Access is gated to
// super_admin by middleware.RequireUserRole on the route — the
// handler itself only checks the request body.
//
// Returns:
//   - 202 Accepted (the email is dispatched, not the API resource):
//     `data.message_id` echoes Resend's id for support correlation.
//   - 400 when the locale is not one of the configured templates.
//   - 502 when the upstream Resend call fails (the curl
//     "upstream provider" status).
//   - 500 for any other terminal error.
func (h *EmailHandler) SendWelcome(c fiber.Ctx) error {
	const operation = "EmailHandler:SendWelcome"
	log.Debug(operation, "request received")

	user, ok := middleware.GetRequestUser(c)
	if !ok {
		log.Error(operation, "err", fiber.ErrUnauthorized)
		return middleware.UnauthorizedResponse(c)
	}

	req, ok := utils.GetValidatedBody[dto.SendWelcomeEmailRequest](c)
	if !ok {
		log.Error(operation, "err", fiber.ErrBadRequest, "reason", "invalid request body")
		return middleware.BadRequestResponse(c, "invalid request body")
	}

	log.Debug(operation, "dispatching welcome email",
		"actorID", user.ID,
		"to", req.Email,
		"locale", req.Language,
	)
	messageID, err := h.service.SendWelcome(c.Context(), email.WelcomeInput{
		To:                req.Email,
		FirstName:         req.FirstName,
		TemporaryPassword: req.TemporaryPassword,
		Subject:           req.Subject,
		Language:          req.Language,
	})
	if err != nil {
		if errors.Is(err, email.ErrInvalidLanguage) {
			log.Error(operation, "err", err, "locale", req.Language)
			return middleware.BadRequestResponse(c, "invalid language")
		}
		log.Error(operation, "err", err, "to", req.Email)
		return c.Status(fiber.StatusBadGateway).JSON(response.HTTPResponse[bool]{
			StatusCode: fiber.StatusBadGateway,
			Message:    "upstream email provider failed",
		})
	}

	log.Info(operation, "welcome email dispatched", "messageID", messageID, "to", req.Email, "locale", req.Language)
	return c.Status(fiber.StatusAccepted).JSON(response.HTTPResponse[dto.SendWelcomeEmailResponse]{
		StatusCode: fiber.StatusAccepted,
		Message:    "welcome email dispatched",
		Data: dto.SendWelcomeEmailResponse{
			MessageID: messageID,
		},
	})
}
