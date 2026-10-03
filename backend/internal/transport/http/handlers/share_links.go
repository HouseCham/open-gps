package handlers

import (
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"

	"github.com/HouseCham/gps-tracker/backend/internal/app/sharelinks"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
	"github.com/HouseCham/gps-tracker/backend/utils"
)

type ShareLinksHandler struct {
	service *sharelinks.Service
}

func NewShareLinksHandler(service *sharelinks.Service) *ShareLinksHandler {
	return &ShareLinksHandler{service: service}
}

func (h *ShareLinksHandler) Create(c fiber.Ctx) error {
	user, ok := middleware.GetRequestUser(c)
	if !ok {
		return middleware.UnauthorizedResponse(c)
	}
	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		return middleware.BadRequestResponse(c, "invalid device id")
	}
	req, ok := utils.GetValidatedBody[dto.CreateShareLinkRequest](c)
	if !ok {
		return middleware.BadRequestResponse(c, "invalid request body")
	}

	created, err := h.service.Create(c.Context(), deviceID, user.ID, req.DurationHours)
	if err != nil {
		if err == sharelinks.ErrInvalidDuration {
			return middleware.BadRequestResponse(c, "duration must be 1, 2, 4, or 8 hours")
		}
		log.Error("ShareLinksHandler.Create", "err", err, "deviceID", deviceID)
		return fmt.Errorf("ShareLinksHandler.Create: %w", err)
	}
	c.Set("Cache-Control", "no-store")
	return c.Status(fiber.StatusCreated).JSON(response.HTTPResponse[dto.CreateShareLinkResponse]{
		StatusCode: fiber.StatusCreated,
		Message:    "share link created",
		Data: dto.CreateShareLinkResponse{
			ShareLinkResponse: dto.ShareLinkResponse{
				ID:        created.Link.ID.String(),
				CreatedAt: created.Link.CreatedAt,
				ExpiresAt: created.Link.ExpiresAt,
			},
			Token: created.Token,
		},
	})
}

func (h *ShareLinksHandler) List(c fiber.Ctx) error {
	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		return middleware.BadRequestResponse(c, "invalid device id")
	}
	links, err := h.service.ListActive(c.Context(), deviceID)
	if err != nil {
		log.Error("ShareLinksHandler.List", "err", err, "deviceID", deviceID)
		return fmt.Errorf("ShareLinksHandler.List: %w", err)
	}
	items := make([]dto.ShareLinkResponse, 0, len(links))
	for _, link := range links {
		items = append(items, dto.ShareLinkResponse{
			ID:        link.ID.String(),
			CreatedAt: link.CreatedAt,
			ExpiresAt: link.ExpiresAt,
		})
	}
	return c.Status(fiber.StatusOK).JSON(response.HTTPResponse[[]dto.ShareLinkResponse]{
		StatusCode: fiber.StatusOK,
		Message:    "share links listed",
		Data:       items,
	})
}

func (h *ShareLinksHandler) Revoke(c fiber.Ctx) error {
	deviceID, err := middleware.ParseUUIDParam(c, "id")
	if err != nil {
		return middleware.BadRequestResponse(c, "invalid device id")
	}
	linkID, err := middleware.ParseUUIDParam(c, "linkId")
	if err != nil {
		return middleware.BadRequestResponse(c, "invalid share link id")
	}
	if err := h.service.Revoke(c.Context(), deviceID, linkID); err != nil {
		log.Error("ShareLinksHandler.Revoke", "err", err, "deviceID", deviceID, "linkID", linkID)
		return fmt.Errorf("ShareLinksHandler.Revoke: %w", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
