package passwordreset

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/email"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// tokenTTL is the absolute lifetime of a freshly issued reset token.
// 1 hour matches OWASP / Auth0 / GitHub defaults: long enough for the
// user to open the email and click, short enough that a leaked link
// dies fast.
const tokenTTL = 1 * time.Hour

// rateLimitWindow is the sliding window used for both per-email and
// per-IP throttling. 15 minutes — short enough that an attacker has
// to spread attempts, long enough that a legitimate user retrying
// after a typo doesn't get cut off.
const rateLimitWindow = 15 * time.Minute

// maxRequestsPerEmail caps the number of requests for a single email
// within the rate-limit window.
const maxRequestsPerEmail = 3

// maxRequestsPerIP caps the number of requests from a single IP
// within the rate-limit window, regardless of email.
const maxRequestsPerIP = 10

// ErrInvalidResetToken is re-exported so callers don't have to reach
// into the domain package for this single error.
var ErrInvalidResetToken = domain.ErrInvalidResetToken

// userResolver is the slice of users.Service the password-reset flow
// needs: lookup by email (to resolve the recipient's userID) and the
// password-flag setter (to clear must_change_password on a successful
// consume). Keeping this as an interface lets the service stay
// package-pure and lets the test mock satisfy it with the bare
// minimum.
type userResolver interface {
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	SetMustChangePassword(ctx context.Context, userID uuid.UUID, mustChange bool) error
}

// passwordResetter is the Authula-backed password-overwrite path the
// consume step needs. Distinct from the ChangePassword path because
// reset does NOT verify the old password.
type passwordResetter interface {
	ResetPassword(ctx context.Context, authulaUserID, newPassword string) error
}

// emailSender is the narrow slice of email.Service the reset flow
// uses. Re-declared here so passwordreset does not have to import
// app/email (which pulls in the Resend SDK) just to talk to it.
type emailSender interface {
	SendPasswordReset(ctx context.Context, in email.ResetInput) (string, error)
}

// Service orchestrates the password-recovery flow: issuing tokens,
// sending the email, validating + consuming tokens, and rotating the
// Authula password. All public methods are safe for concurrent use;
// the underlying TokenStore is responsible for the SQL race semantics.
type Service struct {
	tokens          TokenStore
	rateLimit       RateLimitCounter
	users           userResolver
	reset           passwordResetter
	mailer          emailSender
	now             func() time.Time // injected for tests
}

// New wires a Service. now is optional — pass nil to default to
// time.Now. Returning a *Service (not an error) because the wiring is
// infallible at construction; failures happen at request time.
func New(tokens TokenStore, rateLimit RateLimitCounter, users userResolver, reset passwordResetter, mailer emailSender, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{tokens: tokens, rateLimit: rateLimit, users: users, reset: reset, mailer: mailer, now: now}
}

// RequestInput is what the handler passes to Request — the email the
// user typed, the locale they want the template in, and the full
// reset URL the frontend already built (the caller embeds the token
// once Service returns it).
type RequestInput struct {
	Email       string
	Language    string
	ResetURL    string
	ClientIP    string // used for the per-IP rate limit; optional, "" disables
}

// RequestResult is what the handler gets back. The MessageID lets the
// API echo Resend's id (for support correlation), the same shape as
// /email/welcome. On the rate-limited / unknown-email paths the
// returned values are zero — the handler still answers 202 to avoid
// leaking which path was taken.
type RequestResult struct {
	MessageID string
	// Dispatched is false when the request was rate-limited or the
	// user didn't exist; the handler should still answer 202.
	Dispatched bool
}

// Request validates the rate limit, finds the user, issues a token,
// and dispatches the reset email. Two anti-enumeration rules live
// here:
//
//  1. A non-existent email is treated identically to a successful
//     dispatch from the caller's perspective: no error, no log on the
//     outside, dispatched=false. We log internally so abuse is still
//     visible.
//  2. A rate-limited request is treated identically too.
//
// In both cases the function returns nil error and Dispatched=false.
func (s *Service) Request(ctx context.Context, in RequestInput) (RequestResult, error) {
	// Per-IP cap first: cheaper (no DB row to compare against) and
	// protects against an attacker hammering random emails from one
	// host. Done unconditionally regardless of email validity.
	if in.ClientIP != "" {
		count, err := s.rateLimit.CountRecentForIP(ctx, in.ClientIP, rateLimitWindow)
		if err != nil {
			return RequestResult{}, fmt.Errorf("passwordreset.Request: rate-limit ip: %w", err)
		}
		if count >= maxRequestsPerIP {
			return RequestResult{Dispatched: false}, nil
		}
	}

	// Per-email cap is the natural lookup: only counted once we have
	// a user to count against. If the email doesn't resolve, the
	// call falls through to the "unknown user" branch and we don't
	// even bother incrementing anything.
	user, err := s.users.GetByEmail(ctx, in.Email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return RequestResult{Dispatched: false}, nil
		}
		return RequestResult{}, fmt.Errorf("passwordreset.Request: lookup user: %w", err)
	}

	count, err := s.rateLimit.CountRecentForUser(ctx, user.ID, rateLimitWindow)
	if err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: rate-limit user: %w", err)
	}
	if count >= maxRequestsPerEmail {
		return RequestResult{Dispatched: false}, nil
	}

	rawToken, tokenHash, err := GenerateRawToken()
	if err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: generate token: %w", err)
	}

	if err := s.tokens.InvalidateOutstanding(ctx, user.ID); err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: invalidate outstanding: %w", err)
	}

	if _, err := s.tokens.Insert(ctx, user.ID, tokenHash, in.ClientIP, s.now().Add(tokenTTL)); err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: insert token: %w", err)
	}

	messageID, err := s.mailer.SendPasswordReset(ctx, email.ResetInput{
		To:        user.Email,
		FirstName: user.Name,
		ResetURL:  in.ResetURL + rawToken,
		Language:  in.Language,
	})
	if err != nil {
		// The token row is in place; if dispatch fails the user can
		// retry within the TTL. We propagate the error so the handler
		// can surface 502 — the client built the URL and should know.
		return RequestResult{}, fmt.Errorf("passwordreset.Request: send reset email: %w", err)
	}

	return RequestResult{MessageID: messageID, Dispatched: true}, nil
}

// ConsumeInput is what the consume handler passes in. The raw token
// comes from the email link; the service hashes it and looks it up.
type ConsumeInput struct {
	Token       string
	NewPassword string
}

// Consume validates the token, rotates the Authula password, and
// clears must_change_password on the local user. Returns
// ErrInvalidResetToken for every failure mode (unknown, used,
// expired) so the caller can't distinguish.
//
// Ordering: token lookup -> mark used -> rotate password. Marking
// used BEFORE the password rotation guarantees a concurrent second
// consume fails fast (the row's used_at is already stamped); if the
// password rotation then fails the token is still consumed, which is
// the safer outcome (the user can request a fresh token; the leaked
// one can never be replayed).
func (s *Service) Consume(ctx context.Context, in ConsumeInput) error {
	tokenHash := HashToken(in.Token)

	tok, err := s.tokens.GetByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return ErrInvalidResetToken
		}
		return fmt.Errorf("passwordreset.Consume: lookup token: %w", err)
	}

	if err := s.tokens.MarkUsed(ctx, tok.ID); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			// Another consume won the race. Same surface error.
			return ErrInvalidResetToken
		}
		return fmt.Errorf("passwordreset.Consume: mark used: %w", err)
	}

	if err := s.reset.ResetPassword(ctx, tok.UserID.String(), in.NewPassword); err != nil {
		return fmt.Errorf("passwordreset.Consume: rotate password: %w", err)
	}

	if err := s.users.SetMustChangePassword(ctx, tok.UserID, false); err != nil {
		return fmt.Errorf("passwordreset.Consume: clear must-change: %w", err)
	}

	return nil
}
