package passwordreset_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/email"
	"github.com/HouseCham/gps-tracker/backend/internal/app/passwordreset"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// fakeRepo is an in-memory TokenStore + RateLimitCounter good enough
// to exercise the service's branching. It does NOT enforce SQL-level
// semantics (atomic MarkUsed, etc.) — that's the postgres adapter's
// job. The service-level rules are what this file tests.
type fakeRepo struct {
	tokens       map[string]passwordreset.Token // key = tokenHash
	byUser       map[uuid.UUID][]passwordreset.Token
	recentByUser map[uuid.UUID]int
	recentByIP   map[string]int
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		tokens:       map[string]passwordreset.Token{},
		byUser:       map[uuid.UUID][]passwordreset.Token{},
		recentByUser: map[uuid.UUID]int{},
		recentByIP:   map[string]int{},
	}
}

func (f *fakeRepo) Insert(_ context.Context, userID uuid.UUID, tokenHash, _ string, expiresAt time.Time) (passwordreset.Token, error) {
	t := passwordreset.Token{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	f.tokens[tokenHash] = t
	f.byUser[userID] = append(f.byUser[userID], t)
	f.recentByUser[userID]++
	return t, nil
}

func (f *fakeRepo) GetByHash(_ context.Context, tokenHash string) (passwordreset.Token, error) {
	t, ok := f.tokens[tokenHash]
	if !ok {
		return passwordreset.Token{}, domain.ErrNotFound
	}
	if t.UsedAt != nil {
		return passwordreset.Token{}, domain.ErrNotFound
	}
	if !t.ExpiresAt.After(time.Now()) {
		return passwordreset.Token{}, domain.ErrNotFound
	}
	return t, nil
}

func (f *fakeRepo) MarkUsed(_ context.Context, id uuid.UUID) error {
	for k, t := range f.tokens {
		if t.ID == id {
			if t.UsedAt != nil {
				return domain.ErrNotFound
			}
			now := time.Now()
			t.UsedAt = &now
			f.tokens[k] = t
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeRepo) CountRecentForUser(_ context.Context, userID uuid.UUID, _ time.Duration) (int, error) {
	return f.recentByUser[userID], nil
}

func (f *fakeRepo) CountRecentForIP(_ context.Context, ip string, _ time.Duration) (int, error) {
	return f.recentByIP[ip], nil
}

func (f *fakeRepo) InvalidateOutstanding(_ context.Context, userID uuid.UUID) error {
	for k, t := range f.tokens {
		if t.UserID != userID || t.UsedAt != nil {
			continue
		}
		if !t.ExpiresAt.After(time.Now()) {
			continue
		}
		now := time.Now()
		t.UsedAt = &now
		f.tokens[k] = t
	}
	return nil
}

// stubUsers is the slice of users.Service the reset flow consumes.
type stubUsers struct {
	byEmail            map[string]*domain.User
	setMustChangeCalls int
}

func (s *stubUsers) GetByEmail(_ context.Context, email string) (*domain.User, error) {
	if u, ok := s.byEmail[email]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (s *stubUsers) SetMustChangePassword(_ context.Context, _ uuid.UUID, _ bool) error {
	s.setMustChangeCalls++
	return nil
}

type stubResetter struct {
	called bool
	err    error
}

func (s *stubResetter) ResetPassword(_ context.Context, _, _ string) error {
	s.called = true
	return s.err
}

type stubMailer struct {
	mid       string
	calls     int
	resetURLs []string
}

func (s *stubMailer) SendPasswordReset(_ context.Context, in email.ResetInput) (string, error) {
	s.calls++
	s.resetURLs = append(s.resetURLs, in.ResetURL)
	return s.mid, nil
}

func newSvc(t *testing.T, repo *fakeRepo, users *stubUsers, reset *stubResetter, mail *stubMailer) *passwordreset.Service {
	t.Helper()
	return passwordreset.New(repo, repo, users, reset, mail, nil)
}

func TestRequest_HappyPath_DispatchesAndReturnsMessageID(t *testing.T) {
	repo := newFakeRepo()
	users := &stubUsers{byEmail: map[string]*domain.User{
		"u@x.com": {ID: uuid.New(), Email: "u@x.com", Name: "Ana"},
	}}
	mail := &stubMailer{mid: "resend-123"}

	svc := newSvc(t, repo, users, &stubResetter{}, mail)
	res, err := svc.Request(context.Background(), passwordreset.RequestInput{
		Email:    "u@x.com",
		Language: "en",
		ResetURL: "https://app/reset?token=",
	})
	if err != nil {
		t.Fatalf("Request: unexpected err: %v", err)
	}
	if !res.Dispatched {
		t.Fatal("Dispatched=false on happy path")
	}
	if res.MessageID != "resend-123" {
		t.Errorf("MessageID = %q, want resend-123", res.MessageID)
	}
	if mail.calls != 1 {
		t.Errorf("mailer.calls = %d, want 1", mail.calls)
	}
	// The mailer must have received the raw token appended to the URL.
	if got := mail.resetURLs[0]; len(got) <= len("https://app/reset?token=") {
		t.Errorf("ResetURL = %q, expected raw token suffix", got)
	}
}

func TestRequest_UnknownEmail_ReturnsSilently(t *testing.T) {
	repo := newFakeRepo()
	users := &stubUsers{byEmail: map[string]*domain.User{}}
	mail := &stubMailer{}

	svc := newSvc(t, repo, users, &stubResetter{}, mail)
	res, err := svc.Request(context.Background(), passwordreset.RequestInput{
		Email:    "nobody@x.com",
		Language: "en",
		ResetURL: "https://app/reset?token=",
	})
	if err != nil {
		t.Fatalf("Request: unexpected err: %v", err)
	}
	if res.Dispatched {
		t.Error("Dispatched=true on unknown email — leaks user existence")
	}
	if mail.calls != 0 {
		t.Error("mailer was called for an unknown email")
	}
}

func TestRequest_RateLimitedByEmail_ReturnsSilently(t *testing.T) {
	repo := newFakeRepo()
	users := &stubUsers{byEmail: map[string]*domain.User{
		"u@x.com": {ID: uuid.New(), Email: "u@x.com", Name: "Ana"},
	}}
	repo.recentByUser[users.byEmail["u@x.com"].ID] = 3 // at the cap
	mail := &stubMailer{}

	svc := newSvc(t, repo, users, &stubResetter{}, mail)
	res, err := svc.Request(context.Background(), passwordreset.RequestInput{
		Email: "u@x.com", Language: "en", ResetURL: "https://app/reset?token=",
	})
	if err != nil {
		t.Fatalf("Request: unexpected err: %v", err)
	}
	if res.Dispatched {
		t.Error("Dispatched=true under rate-limit — leaks that the email exists")
	}
	if mail.calls != 0 {
		t.Error("mailer was called under rate-limit")
	}
}

func TestRequest_RateLimitedByIP_ReturnsSilently(t *testing.T) {
	repo := newFakeRepo()
	users := &stubUsers{byEmail: map[string]*domain.User{
		"u@x.com": {ID: uuid.New(), Email: "u@x.com", Name: "Ana"},
	}}
	repo.recentByIP["1.2.3.4"] = 10 // at the cap
	mail := &stubMailer{}

	svc := newSvc(t, repo, users, &stubResetter{}, mail)
	res, err := svc.Request(context.Background(), passwordreset.RequestInput{
		Email:    "u@x.com",
		Language: "en",
		ResetURL: "https://app/reset?token=",
		ClientIP: "1.2.3.4",
	})
	if err != nil {
		t.Fatalf("Request: unexpected err: %v", err)
	}
	if res.Dispatched {
		t.Error("Dispatched=true under IP rate-limit")
	}
	if mail.calls != 0 {
		t.Error("mailer was called under IP rate-limit")
	}
}

func TestConsume_HappyPath_RotatesAndClearsFlag(t *testing.T) {
	repo := newFakeRepo()
	users := &stubUsers{byEmail: map[string]*domain.User{
		"u@x.com": {ID: uuid.New(), Email: "u@x.com", Name: "Ana"},
	}}
	reset := &stubResetter{}
	mail := &stubMailer{mid: "x"}
	svc := passwordreset.New(repo, repo, users, reset, mail, nil)

	res, err := svc.Request(context.Background(), passwordreset.RequestInput{
		Email: "u@x.com", Language: "en", ResetURL: "https://app/reset?token=",
	})
	if err != nil || !res.Dispatched {
		t.Fatalf("setup: Request failed (err=%v, dispatched=%v)", err, res.Dispatched)
	}
	rawToken := mail.resetURLs[0][len("https://app/reset?token="):]
	if rawToken == "" {
		t.Fatal("setup: empty raw token")
	}

	if err := svc.Consume(context.Background(), passwordreset.ConsumeInput{
		Token:       rawToken,
		NewPassword: "new-secret",
	}); err != nil {
		t.Fatalf("Consume: unexpected err: %v", err)
	}
	if !reset.called {
		t.Error("ResetPassword was not called")
	}
	if users.setMustChangeCalls != 1 {
		t.Errorf("SetMustChangePassword calls = %d, want 1", users.setMustChangeCalls)
	}
}

func TestConsume_InvalidToken_ReturnsErrInvalidResetToken(t *testing.T) {
	svc := newSvc(t, newFakeRepo(), &stubUsers{byEmail: map[string]*domain.User{}}, &stubResetter{}, &stubMailer{})
	err := svc.Consume(context.Background(), passwordreset.ConsumeInput{Token: "deadbeef", NewPassword: "newsecret"})
	if !errors.Is(err, passwordreset.ErrInvalidResetToken) {
		t.Fatalf("got err=%v, want ErrInvalidResetToken", err)
	}
}

func TestConsume_SecondUseOfSameToken_ReturnsErrInvalidResetToken(t *testing.T) {
	repo := newFakeRepo()
	users := &stubUsers{byEmail: map[string]*domain.User{
		"u@x.com": {ID: uuid.New(), Email: "u@x.com", Name: "Ana"},
	}}
	mail := &stubMailer{mid: "x"}
	svc := passwordreset.New(repo, repo, users, &stubResetter{}, mail, nil)
	res, err := svc.Request(context.Background(), passwordreset.RequestInput{
		Email: "u@x.com", Language: "en", ResetURL: "https://app/reset?token=",
	})
	if err != nil || !res.Dispatched {
		t.Fatalf("setup: Request failed (err=%v, dispatched=%v)", err, res.Dispatched)
	}
	rawToken := mail.resetURLs[0][len("https://app/reset?token="):]

	if err := svc.Consume(context.Background(), passwordreset.ConsumeInput{Token: rawToken, NewPassword: "newsecret"}); err != nil {
		t.Fatalf("first Consume: unexpected err: %v", err)
	}
	if err := svc.Consume(context.Background(), passwordreset.ConsumeInput{Token: rawToken, NewPassword: "another"}); !errors.Is(err, passwordreset.ErrInvalidResetToken) {
		t.Fatalf("second Consume: got err=%v, want ErrInvalidResetToken", err)
	}
}
