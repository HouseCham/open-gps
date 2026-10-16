package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"
)

// readyTimeout bounds the readiness dependency check so a hung
// database cannot hold orchestrator probes open.
const readyTimeout = 2 * time.Second

type HealthHandler struct {
	// ping is the readiness dependency (pgxpool.Pool.Ping). Nil means
	// no dependency to check (httptest app): the process alone is
	// the signal.
	ping func(ctx context.Context) error
}

// NewHealthHandler creates a new instance of HealthHandler.
func NewHealthHandler(ping func(ctx context.Context) error) *HealthHandler {
	return &HealthHandler{ping: ping}
}

// Handle answers the liveness probe: the process is up and serving.
// No dependency is touched — a database outage must not restart the
// container.
func (h *HealthHandler) Handle(c fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status": "ok",
	})
}

// Ready answers the readiness probe: 200 only when the API can reach
// its critical dependency; 503 otherwise. Internals are never leaked
// to the client.
func (h *HealthHandler) Ready(c fiber.Ctx) error {
	if h.ping == nil {
		return c.JSON(fiber.Map{
			"status": "ok",
		})
	}
	ctx, cancel := context.WithTimeout(c.Context(), readyTimeout)
	defer cancel()
	if err := h.ping(ctx); err != nil {
		log.Error("readiness probe failed", "err", err)
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status": "unavailable",
		})
	}
	return c.JSON(fiber.Map{
		"status": "ok",
	})
}
