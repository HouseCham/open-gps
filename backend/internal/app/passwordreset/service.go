package passwordreset

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
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

// resetPasswordPath is the fixed frontend path the reset link lands
// on. Combined server-side with the configured public origin and the
// request locale: {origin}/{locale}/reset-password?token={rawToken}.
const resetPasswordPath = "/reset-password"

// ErrInvalidResetToken is re-exported so callers don't have to reach
// into the domain package for this single error.
var ErrInvalidResetToken = domain.ErrInvalidResetToken

// ErrEmailDispatch marks a failure to hand the reset email to the
// upstream provider. The token was already persisted, so the failure
// is not terminal for the user (they can retry), but the handler must
// answer the same 202 as every other path — a distinct status would
// let callers probe which emails exist (the Resend call only happens
// for known addresses).
var ErrEmailDispatch = errors.New("password recovery email dispatch failed")

// ErrClientIPRequired prevents a caller from silently bypassing the
// per-IP recovery budget with an empty or malformed client address.
var ErrClientIPRequired = errors.New("password recovery requires a valid client IP")

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
	tokens       TokenStore
	rateLimit    RateLimitCounter
	users        userResolver
	reset        passwordResetter
	mailer       emailSender
	publicOrigin string           // bare origin used to build reset links
	now          func() time.Time // injected for tests
}

// New wires a Service. publicOrigin is the bare public origin
// (scheme + host) reset links are built from; now is optional — pass
// nil to default to time.Now. Returning a *Service (not an error)
// because the wiring is infallible at construction; failures happen
// at request time.
func New(tokens TokenStore, rateLimit RateLimitCounter, users userResolver, reset passwordResetter, mailer emailSender, publicOrigin string, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{tokens: tokens, rateLimit: rateLimit, users: users, reset: reset, mailer: mailer, publicOrigin: publicOrigin, now: now}
}

// RequestInput is what the handler passes to Request — the email the
// user typed and the locale they want the template in. The reset URL
// is built by the service from its configured public origin; the
// caller cannot influence the destination.
type RequestInput struct {
	Email    string
	Language string
	ClientIP string // validated client IP used for the per-IP rate limit
}

// RequestResult is what the handler gets back. The MessageID is for
// server-side logging/support correlation only — it is never put on
// the wire. On the rate-limited / unknown-email paths the returned
// values are zero; the handler answers the same 202 regardless, so
// the response cannot be used to enumerate accounts.
type RequestResult struct {
	MessageID string
	// Dispatched is false when the request was rate-limited or the
	// user didn't exist; the handler still answers 202.
	Dispatched bool
}

// Request records the attempt, finds the user, issues a token, and
// dispatches the reset email. Three anti-enumeration rules live
// here:
//
//  1. A non-existent email is treated identically to a successful
//     dispatch from the caller's perspective: no error, no log on the
//     outside, dispatched=false. We log internally so abuse is still
//     visible.
//  2. A rate-limited request is treated identically too.
//  3. An upstream email failure returns ErrEmailDispatch so the
//     handler can log it but still answer the same 202 — a distinct
//     status would only ever be reachable for known emails.
//
// In cases 1 and 2 the function returns nil error and Dispatched=false.
func (s *Service) Request(ctx context.Context, in RequestInput) (RequestResult, error) {
	parsedIP := net.ParseIP(strings.TrimSpace(in.ClientIP))
	if parsedIP == nil {
		return RequestResult{}, ErrClientIPRequired
	}
	clientIP := parsedIP.String()

	// Per-IP cap first, and it counts the attempt itself — known or
	// unknown email — so probing random addresses burns the same
	// budget as real requests (BA-07).
	allowed, err := s.rateLimit.RegisterIPAttempt(ctx, clientIP, rateLimitWindow, maxRequestsPerIP)
	if err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: rate-limit ip: %w", err)
	}
	if !allowed {
		return RequestResult{Dispatched: false}, nil
	}

	user, err := s.users.GetByEmail(ctx, in.Email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return RequestResult{Dispatched: false}, nil
		}
		return RequestResult{}, fmt.Errorf("passwordreset.Request: lookup user: %w", err)
	}

	rawToken, tokenHash, err := GenerateRawToken()
	if err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: generate token: %w", err)
	}

	// Per-email cap is enforced here: count + invalidate + insert run
	// in one transaction behind a per-user lock, so concurrent
	// requests cannot overshoot the cap (BA-07).
	issued, err := s.tokens.InsertIfUnderLimit(ctx, user.ID, tokenHash, clientIP, s.now().Add(tokenTTL), rateLimitWindow, maxRequestsPerEmail)
	if err != nil {
		return RequestResult{}, fmt.Errorf("passwordreset.Request: issue token: %w", err)
	}
	if !issued {
		return RequestResult{Dispatched: false}, nil
	}

	// The destination is built entirely server-side: configured
	// origin + locale + fixed path. The raw token is appended last so
	// the client never sees or chooses it.
	resetURL := s.publicOrigin + "/" + in.Language + resetPasswordPath + "?token=" + rawToken

	messageID, err := s.mailer.SendPasswordReset(ctx, email.ResetInput{
		To:        user.Email,
		FirstName: user.Name,
		ResetURL:  resetURL,
		Language:  in.Language,
	})
	if err != nil {
		// Token row is in place; a retry within the TTL issues a fresh
		// one. Marked with ErrEmailDispatch so the handler can answer
		// the same 202 as every other path (anti-enumeration) instead
		// of surfacing a status that only reachable for known emails.
		if errors.Is(err, email.ErrInvalidLanguage) {
			return RequestResult{}, fmt.Errorf("passwordreset.Request: send reset email: %w", err)
		}
		return RequestResult{}, fmt.Errorf("passwordreset.Request: send reset email: %w: %w", ErrEmailDispatch, err)
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
