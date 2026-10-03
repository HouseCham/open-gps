package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/app/sharelinks"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type DeviceShareLinksAdapter struct {
	pool *pgxpool.Pool
}

func NewDeviceShareLinksAdapter(pool *pgxpool.Pool) *DeviceShareLinksAdapter {
	return &DeviceShareLinksAdapter{pool: pool}
}

func (a *DeviceShareLinksAdapter) Create(ctx context.Context, deviceID, ownerID uuid.UUID, tokenHash string, expiresAt time.Time) (sharelinks.Link, error) {
	row, err := New(a.pool).CreateDeviceShareLink(ctx, CreateDeviceShareLinkParams{
		DeviceID:  PgtypeUUID(deviceID),
		CreatedBy: PgtypeUUID(ownerID),
		TokenHash: tokenHash,
		ExpiresAt: PgtypeTimestamptz(expiresAt),
	})
	if err != nil {
		return sharelinks.Link{}, fmt.Errorf("DeviceShareLinksAdapter.Create: %w", WrapPgError(err))
	}
	return shareLinkFromRow(row), nil
}

func (a *DeviceShareLinksAdapter) ListActive(ctx context.Context, deviceID uuid.UUID) ([]sharelinks.Link, error) {
	rows, err := New(a.pool).ListActiveDeviceShareLinks(ctx, PgtypeUUID(deviceID))
	if err != nil {
		return nil, fmt.Errorf("DeviceShareLinksAdapter.ListActive: %w", WrapPgError(err))
	}
	links := make([]sharelinks.Link, 0, len(rows))
	for _, row := range rows {
		links = append(links, shareLinkFromRow(row))
	}
	return links, nil
}

func (a *DeviceShareLinksAdapter) Revoke(ctx context.Context, deviceID, linkID uuid.UUID) error {
	if err := New(a.pool).RevokeDeviceShareLink(ctx, RevokeDeviceShareLinkParams{
		ID:       PgtypeUUID(linkID),
		DeviceID: PgtypeUUID(deviceID),
	}); err != nil {
		return fmt.Errorf("DeviceShareLinksAdapter.Revoke: %w", WrapPgError(err))
	}
	return nil
}

func (a *DeviceShareLinksAdapter) GetActiveByTokenHash(ctx context.Context, tokenHash string) (sharelinks.Link, error) {
	row, err := New(a.pool).GetValidDeviceShareLinkByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sharelinks.Link{}, domain.ErrNotFound
		}
		return sharelinks.Link{}, fmt.Errorf("DeviceShareLinksAdapter.GetActiveByTokenHash: %w", WrapPgError(err))
	}
	return sharelinks.Link{
		ID:         UuidFromPgtype(row.ID),
		DeviceID:   UuidFromPgtype(row.DeviceID),
		CreatedBy:  UuidFromPgtype(row.CreatedBy),
		CreatedAt:  row.CreatedAt.Time,
		ExpiresAt:  row.ExpiresAt.Time,
		DeviceName: row.DeviceName,
	}, nil
}

func shareLinkFromRow(row DeviceShareLink) sharelinks.Link {
	link := sharelinks.Link{
		ID:        UuidFromPgtype(row.ID),
		DeviceID:  UuidFromPgtype(row.DeviceID),
		CreatedBy: UuidFromPgtype(row.CreatedBy),
		CreatedAt: row.CreatedAt.Time,
		ExpiresAt: row.ExpiresAt.Time,
	}
	if row.RevokedAt.Valid {
		revokedAt := row.RevokedAt.Time
		link.RevokedAt = &revokedAt
	}
	return link
}
