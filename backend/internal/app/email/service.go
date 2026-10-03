package email

import (
	"context"
	"errors"
	"fmt"

	"github.com/resend/resend-go/v3"
)

// ErrInvalidLanguage is returned when the requested locale is not
// one of the templates the service was configured with.
var ErrInvalidLanguage = errors.New("invalid language")

// WelcomeInput is the handler-facing payload for a welcome email.
// Subject is forwarded to Resend (the template engine keeps the
// actual subject it renders, but the SDK requires the field on
// SendEmailRequest).
type WelcomeInput struct {
	To               string
	FirstName        string
	TemporaryPassword string
	Subject          string
	Language         string
}

// ResetInput is the handler-facing payload for a password-reset email.
// ResetURL is the full URL the user clicks (the caller already embedded
// the token); we forward it to Resend verbatim.
type ResetInput struct {
	To        string
	FirstName string
	ResetURL  string
	Language  string
}

// Service is the application-layer wrapper around the Resend SDK.
// It hides the SDK type behind concrete methods so the handler only
// deals with domain-shaped inputs.
type Service struct {
	client       *resend.Client
	from         string
	welcomeByLang map[string]string
	resetByLang   map[string]string
}

// New builds a Service from an already-configured Resend client and
// the per-language template IDs. The template map is owned by the
// caller — the service keeps the reference for the lifetime of the
// process.
func New(client *resend.Client, from string, welcomeTemplates, resetTemplates map[string]string) *Service {
	return &Service{
		client:        client,
		from:          from,
		welcomeByLang: copyMap(welcomeTemplates),
		resetByLang:   copyMap(resetTemplates),
	}
}

func copyMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

// SendWelcome dispatches the welcome email for the given input.
// Returns ErrInvalidLanguage when the locale is not configured, and
// a wrapped error when Resend rejects the send. The returned string
// is Resend's email id (useful for support / logging correlation).
func (s *Service) SendWelcome(ctx context.Context, in WelcomeInput) (string, error) {
	templateID, ok := s.welcomeByLang[in.Language]
	if !ok {
		return "", fmt.Errorf("%w: %q", ErrInvalidLanguage, in.Language)
	}

	req := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{in.To},
		Subject: in.Subject,
		Template: &resend.EmailTemplate{
			Id: templateID,
			Variables: map[string]any{
				"first_name":         in.FirstName,
				"temporary_password": in.TemporaryPassword,
				"email":              in.To,
			},
		},
	}

	sent, err := s.client.Emails.SendWithContext(ctx, req)
	if err != nil {
		return "", fmt.Errorf("resend send welcome: %w", err)
	}
	return sent.Id, nil
}

// SendPasswordReset dispatches the password-reset email for the given
// input. Returns ErrInvalidLanguage when the locale is not configured,
// and a wrapped error when Resend rejects the send.
func (s *Service) SendPasswordReset(ctx context.Context, in ResetInput) (string, error) {
	templateID, ok := s.resetByLang[in.Language]
	if !ok {
		return "", fmt.Errorf("%w: %q", ErrInvalidLanguage, in.Language)
	}

	req := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{in.To},
		Subject: "Password reset",
		Template: &resend.EmailTemplate{
			Id: templateID,
			Variables: map[string]any{
				"first_name":         in.FirstName,
				"email":              in.To,
				"reset_password_url": in.ResetURL,
			},
		},
	}

	sent, err := s.client.Emails.SendWithContext(ctx, req)
	if err != nil {
		return "", fmt.Errorf("resend send password reset: %w", err)
	}
	return sent.Id, nil
}
