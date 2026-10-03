package sharelinks

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type memoryRepository struct {
	links  map[uuid.UUID]Link
	hashes map[string]uuid.UUID
}

func newMemoryRepository() *memoryRepository {
	return &memoryRepository{links: make(map[uuid.UUID]Link), hashes: make(map[string]uuid.UUID)}
}

func (r *memoryRepository) Create(_ context.Context, deviceID, ownerID uuid.UUID, tokenHash string, expiresAt time.Time) (Link, error) {
	link := Link{ID: uuid.New(), DeviceID: deviceID, CreatedBy: ownerID, CreatedAt: time.Now().UTC(), ExpiresAt: expiresAt}
	r.links[link.ID] = link
	r.hashes[tokenHash] = link.ID
	return link, nil
}

func (r *memoryRepository) ListActive(_ context.Context, deviceID uuid.UUID) ([]Link, error) {
	result := make([]Link, 0)
	for _, link := range r.links {
		if link.DeviceID == deviceID && link.RevokedAt == nil && link.ExpiresAt.After(time.Now()) {
			result = append(result, link)
		}
	}
	return result, nil
}

func (r *memoryRepository) Revoke(_ context.Context, deviceID, linkID uuid.UUID) error {
	link, ok := r.links[linkID]
	if ok && link.DeviceID == deviceID && link.RevokedAt == nil {
		now := time.Now().UTC()
		link.RevokedAt = &now
		r.links[linkID] = link
	}
	return nil
}

func (r *memoryRepository) GetActiveByTokenHash(_ context.Context, tokenHash string) (Link, error) {
	id, ok := r.hashes[tokenHash]
	if !ok {
		return Link{}, domain.ErrNotFound
	}
	link := r.links[id]
	if link.RevokedAt != nil || !link.ExpiresAt.After(time.Now()) {
		return Link{}, domain.ErrNotFound
	}
	return link, nil
}

func TestCreateUsesAllowedTTLAndStoresOnlyHash(t *testing.T) {
	for _, hours := range []int{1, 2, 4, 8} {
		t.Run(time.Duration(hours).String(), func(t *testing.T) {
			repo := newMemoryRepository()
			service := New(repo)
			created, err := service.Create(context.Background(), uuid.New(), uuid.New(), hours)
			if err != nil {
				t.Fatal(err)
			}
			if len(created.Token) != 43 {
				t.Fatalf("token length = %d, want 43", len(created.Token))
			}
			if _, stored := repo.hashes[created.Token]; stored {
				t.Fatal("repository stored the raw token")
			}
			if got := created.Link.ExpiresAt.Sub(created.Link.CreatedAt); got < time.Duration(hours)*time.Hour-time.Second || got > time.Duration(hours)*time.Hour+time.Second {
				t.Fatalf("link lifetime = %s, want %dh", got, hours)
			}
		})
	}
}

func TestCreateRejectsUnsupportedTTL(t *testing.T) {
	_, err := New(newMemoryRepository()).Create(context.Background(), uuid.New(), uuid.New(), 3)
	if !errors.Is(err, ErrInvalidDuration) {
		t.Fatalf("error = %v, want ErrInvalidDuration", err)
	}
}

func TestResolveTokenRejectsRevokedAndUnknownTokens(t *testing.T) {
	repo := newMemoryRepository()
	service := New(repo)
	created, err := service.Create(context.Background(), uuid.New(), uuid.New(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.ResolveToken(context.Background(), created.Token); err != nil {
		t.Fatalf("resolve active token: %v", err)
	}
	if err := service.Revoke(context.Background(), created.Link.DeviceID, created.Link.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.ResolveToken(context.Background(), created.Token); !errors.Is(err, ErrInvalidLink) {
		t.Fatalf("resolve revoked token error = %v, want ErrInvalidLink", err)
	}
	if _, err := service.ResolveToken(context.Background(), strings.Repeat("a", 43)); !errors.Is(err, ErrInvalidLink) {
		t.Fatalf("resolve unknown token error = %v, want ErrInvalidLink", err)
	}
}

func TestResolveTokenRejectsExpiredLink(t *testing.T) {
	repo := newMemoryRepository()
	service := New(repo)
	created, err := service.Create(context.Background(), uuid.New(), uuid.New(), 1)
	if err != nil {
		t.Fatal(err)
	}
	link := repo.links[created.Link.ID]
	link.ExpiresAt = time.Now().Add(-time.Second)
	repo.links[link.ID] = link
	if _, err := service.ResolveToken(context.Background(), created.Token); !errors.Is(err, ErrInvalidLink) {
		t.Fatalf("resolve expired token error = %v, want ErrInvalidLink", err)
	}
}
