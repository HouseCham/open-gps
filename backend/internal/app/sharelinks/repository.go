package sharelinks

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Link struct {
	ID         uuid.UUID
	DeviceID   uuid.UUID
	CreatedBy  uuid.UUID
	CreatedAt  time.Time
	ExpiresAt  time.Time
	RevokedAt  *time.Time
	DeviceName string
}

type Repository interface {
	Create(ctx context.Context, deviceID, ownerID uuid.UUID, tokenHash string, expiresAt time.Time) (Link, error)
	ListActive(ctx context.Context, deviceID uuid.UUID) ([]Link, error)
	Revoke(ctx context.Context, deviceID, linkID uuid.UUID) error
	GetActiveByTokenHash(ctx context.Context, tokenHash string) (Link, error)
}
