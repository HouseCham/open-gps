package httptest

import (
	"context"
	"errors"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/email"
	"github.com/HouseCham/gps-tracker/backend/internal/app/passwordreset"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/handlers"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
)

// fakeResetRepo is a minimal TokenStore + RateLimitCounter for the
// generate-token handler tests. SQL-level semantics live in the
// postgres adapter; these tests only need the service branching.
type fakeResetRepo struct {
	alwaysLimited bool
}

func (f *fakeResetRepo) Insert(_ context.Context, userID uuid.UUID, tokenHash, _ string, expiresAt time.Time) (passwordreset.Token, error) {
	return passwordreset.Token{ID: uuid.New(), UserID: userID, TokenHash: tokenHash, ExpiresAt: expiresAt, CreatedAt: time.Now()}, nil
}

func (f *fakeResetRepo) GetByHash(_ context.Context, _ string) (passwordreset.Token, error) {
	return passwordreset.Token{}, domain.ErrNotFound
}

func (f *fakeResetRepo) MarkUsed(_ context.Context, _ uuid.UUID) error { return domain.ErrNotFound }

func (f *fakeResetRepo) CountRecentForUser(_ context.Context, _ uuid.UUID, _ time.Duration) (int, error) {
	return 0, nil
}

func (f *fakeResetRepo) CountRecentForIP(_ context.Context, _ string, _ time.Duration) (int, error) {
	if f.alwaysLimited {
		return 10, nil
	}
	return 0, nil
}

func (f *fakeResetRepo) InvalidateOutstanding(_ context.Context, _ uuid.UUID) error { return nil }

type fakeMailer struct {
	calls int
	err   error
}

func (f *fakeMailer) SendPasswordReset(_ context.Context, _ email.ResetInput) (string, error) {
	f.calls++
	if f.err != nil {
		return "", f.err
	}
	return "resend-id", nil
}

type noopResetter struct{}

func (noopResetter) ResetPassword(_ context.Context, _, _ string) error { return nil }

// newPasswordResetTestApp mounts only the generate-token route on a
// fresh TestApp. The UsersRepo mock backs the service's user lookup.
func newPasswordResetTestApp(t *testing.T, repo *fakeResetRepo, mail *fakeMailer) *TestApp {
	t.Helper()
	ta := NewTestApp()
	svc := passwordreset.New(repo, repo, ta.UsersService, noopResetter{}, mail, "https://app.example.com", nil)
	h := handlers.NewPasswordResetHandler(svc)
	ta.App.Post("/api/v1/auth/generate-pwd-recovery-token",
		middleware.ValidateRequestBody[dto.GeneratePasswordRecoveryTokenRequest](),
		h.GenerateRecoveryToken,
	)
	return ta
}

func TestGenerateRecoveryToken_ResponsesAreIndistinguishable(t *testing.T) {
	const path = "/api/v1/auth/generate-pwd-recovery-token"

	post := func(t *testing.T, ta *TestApp, body map[string]string) string {
		t.Helper()
		resp, err := ta.Request("POST", path, "", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}
		if resp.StatusCode != http.StatusAccepted {
			t.Fatalf("status = %d, want 202", resp.StatusCode)
		}
		raw, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		return string(raw)
	}

	t.Run("known, unknown, rate-limited and mailer-failure share one body", func(t *testing.T) {
		valid := map[string]string{"email": "known@test.com", "locale": "en"}

		// 1. Known email — dispatched.
		mailKnown := &fakeMailer{}
		taKnown := newPasswordResetTestApp(t, &fakeResetRepo{}, mailKnown)
		taKnown.AddUser(&domain.User{ID: uuid.New(), Email: "known@test.com", Name: "Known", CreatedAt: time.Now()})
		knownBody := post(t, taKnown, valid)
		if mailKnown.calls != 1 {
			t.Fatalf("known-email dispatch: mailer.calls = %d, want 1", mailKnown.calls)
		}

		// 2. Unknown email — silently dropped.
		mailUnknown := &fakeMailer{}
		taUnknown := newPasswordResetTestApp(t, &fakeResetRepo{}, mailUnknown)
		unknownBody := post(t, taUnknown, map[string]string{"email": "nobody@test.com", "locale": "en"})
		if mailUnknown.calls != 0 {
			t.Fatalf("unknown-email: mailer.calls = %d, want 0", mailUnknown.calls)
		}

		// 3. Rate-limited IP — silently dropped.
		mailLimited := &fakeMailer{}
		taLimited := newPasswordResetTestApp(t, &fakeResetRepo{alwaysLimited: true}, mailLimited)
		taLimited.AddUser(&domain.User{ID: uuid.New(), Email: "known@test.com", Name: "Known", CreatedAt: time.Now()})
		limitedBody := post(t, taLimited, valid)
		if mailLimited.calls != 0 {
			t.Fatalf("rate-limited: mailer.calls = %d, want 0", mailLimited.calls)
		}

		// 4. Known email, upstream email failure.
		mailFail := &fakeMailer{err: errors.New("resend down")}
		taMailerFail := newPasswordResetTestApp(t, &fakeResetRepo{}, mailFail)
		taMailerFail.AddUser(&domain.User{ID: uuid.New(), Email: "known@test.com", Name: "Known", CreatedAt: time.Now()})
		mailFailBody := post(t, taMailerFail, valid)
		if mailFail.calls != 1 {
			t.Fatalf("mailer-failure: mailer.calls = %d, want 1", mailFail.calls)
		}

		if unknownBody != knownBody {
			t.Errorf("unknown-email body differs:\n known:   %s\n unknown: %s", knownBody, unknownBody)
		}
		if limitedBody != knownBody {
			t.Errorf("rate-limited body differs:\n known:  %s\n limited: %s", knownBody, limitedBody)
		}
		if mailFailBody != knownBody {
			t.Errorf("mailer-failure body differs:\n known: %s\n fail:   %s", knownBody, mailFailBody)
		}
	})
}

func TestGenerateRecoveryToken_Validation(t *testing.T) {
	t.Run("400 - malformed body", func(t *testing.T) {
		ta := newPasswordResetTestApp(t, &fakeResetRepo{}, &fakeMailer{})
		resp, err := ta.Request("POST", "/api/v1/auth/generate-pwd-recovery-token", "", map[string]string{"email": "not-an-email"})
		if err != nil {
			t.Fatalf("request error: %v", err)
		}
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", resp.StatusCode)
		}
	})

	t.Run("400 - extra reset_password_url field is ignored, not required", func(t *testing.T) {
		// A legacy client may still send the removed field; it must
		// not break the request and must not influence the link.
		ta := newPasswordResetTestApp(t, &fakeResetRepo{}, &fakeMailer{})
		ta.AddUser(&domain.User{ID: uuid.New(), Email: "known@test.com", Name: "Known", CreatedAt: time.Now()})
		resp, err := ta.Request("POST", "/api/v1/auth/generate-pwd-recovery-token", "", map[string]string{
			"email":              "known@test.com",
			"locale":             "en",
			"reset_password_url": "https://evil.example.com/steal?token=",
		})
		if err != nil {
			t.Fatalf("request error: %v", err)
		}
		if resp.StatusCode != http.StatusAccepted {
			t.Errorf("status = %d, want 202", resp.StatusCode)
		}
	})
}
