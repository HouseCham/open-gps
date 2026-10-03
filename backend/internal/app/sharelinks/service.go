package sharelinks

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

const tokenBytes = 32

var (
	ErrInvalidDuration = errors.New("invalid share link duration")
	ErrInvalidLink     = errors.New("invalid or expired share link")
)

type Service struct {
	repo Repository
}

type CreatedLink struct {
	Link  Link
	Token string
}

func New(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, deviceID, ownerID uuid.UUID, hours int) (CreatedLink, error) {
	if hours != 1 && hours != 2 && hours != 4 && hours != 8 {
		return CreatedLink{}, ErrInvalidDuration
	}

	secret := make([]byte, tokenBytes)
	if _, err := rand.Read(secret); err != nil {
		return CreatedLink{}, fmt.Errorf("generate share link token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(secret)
	link, err := s.repo.Create(ctx, deviceID, ownerID, hashToken(token), time.Now().UTC().Add(time.Duration(hours)*time.Hour))
	if err != nil {
		return CreatedLink{}, fmt.Errorf("create share link: %w", err)
	}
	return CreatedLink{Link: link, Token: token}, nil
}

func (s *Service) ListActive(ctx context.Context, deviceID uuid.UUID) ([]Link, error) {
	return s.repo.ListActive(ctx, deviceID)
}

func (s *Service) Revoke(ctx context.Context, deviceID, linkID uuid.UUID) error {
	return s.repo.Revoke(ctx, deviceID, linkID)
}

func (s *Service) ResolveToken(ctx context.Context, token string) (Link, error) {
	if len(token) != base64.RawURLEncoding.EncodedLen(tokenBytes) {
		return Link{}, ErrInvalidLink
	}
	link, err := s.repo.GetActiveByTokenHash(ctx, hashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return Link{}, ErrInvalidLink
	}
	if err != nil {
		return Link{}, fmt.Errorf("resolve share link: %w", err)
	}
	return link, nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
