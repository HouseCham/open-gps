package ports

import (
	"context"

	"github.com/Authula/authula/models"
	"github.com/gofiber/fiber/v3"
)

// SessionAuthenticator resolves an Authula actor from a raw session
// token string (the value of the session cookie, NOT yet hashed).
// The cookie name is read separately from the Authula instance so the
// middleware can look the value up on the Fiber request.
type SessionAuthenticator interface {
	Authenticate(ctx context.Context, sessionToken string) (*models.Actor, error)
}

type UserLookup interface {
	GetByID(ctx context.Context, id string) (*models.User, error)
}

type PasswordUpdater interface {
	UpdatePassword(ctx context.Context, authulaUserID, oldPassword, newPassword string) error
	ResetPassword(ctx context.Context, authulaUserID, newPassword string) error
}

type SessionManager interface {
	Invalidate(ctx context.Context, sessionToken string) error
	ClearCookie(c fiber.Ctx)
}