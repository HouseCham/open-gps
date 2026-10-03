package config

import (
	"fmt"
	"net/mail"
	"os"
)

// EmailConfig holds the runtime configuration for the Resend email
// integration. A zero value means "email not configured" — the load
// function returns an error when any required field is missing so the
// process can fail fast at startup rather than 500 on the first
// /api/v1/email/welcome call.
type EmailConfig struct {
	// APIKey is the Resend API key used to authenticate every send.
	APIKey string
	// From is the RFC-5322 "From" header value (e.g. "Open GPS <noreply@open-gps.com>").
	// The SDK forwards it verbatim on every Send call.
	From string
	// TemplateWelcome bundles the two supported welcome templates.
	// The handler picks by the request's `locale` field.
	TemplateWelcome struct {
		EN string
		ES string
	}
	// TemplatePasswordReset bundles the two supported password-reset
	// templates. Same locale-switching contract as TemplateWelcome.
	TemplatePasswordReset struct {
		EN string
		ES string
	}
}

// LoadEmailConfig reads the Resend-related env vars and returns a
// fully populated EmailConfig. Returns an error if any required
// value is missing or malformed — the caller is expected to treat
// this as fatal (the email feature is core, not optional).
func LoadEmailConfig() (EmailConfig, error) {
	cfg := EmailConfig{
		APIKey: os.Getenv("RESEND_API_KEY"),
		From:   os.Getenv("EMAIL_FROM"),
	}
	cfg.TemplateWelcome.EN = os.Getenv("WELCOME_EMAIL_TEMPLATE_EN_ID")
	cfg.TemplateWelcome.ES = os.Getenv("WELCOME_EMAIL_TEMPLATE_ES_ID")
	cfg.TemplatePasswordReset.EN = os.Getenv("PASSWORD_RESET_EMAIL_TEMPLATE_EN_ID")
	cfg.TemplatePasswordReset.ES = os.Getenv("PASSWORD_RESET_EMAIL_TEMPLATE_ES_ID")

	if cfg.APIKey == "" {
		return EmailConfig{}, fmt.Errorf("email config: RESEND_API_KEY is required")
	}
	if cfg.From == "" {
		return EmailConfig{}, fmt.Errorf("email config: EMAIL_FROM is required")
	}
	// Resend's "From" parser is stricter than net/mail — it rejects
	// free-form names without an email address. Catch the wrong
	// shape at startup so the operator sees a clear error instead
	// of a 502 on the first dispatch.
	if _, err := mail.ParseAddress(cfg.From); err != nil {
		return EmailConfig{}, fmt.Errorf("email config: EMAIL_FROM is invalid (%q): %w", cfg.From, err)
	}
	if cfg.TemplateWelcome.EN == "" {
		return EmailConfig{}, fmt.Errorf("email config: WELCOME_EMAIL_TEMPLATE_EN_ID is required")
	}
	if cfg.TemplateWelcome.ES == "" {
		return EmailConfig{}, fmt.Errorf("email config: WELCOME_EMAIL_TEMPLATE_ES_ID is required")
	}
	if cfg.TemplatePasswordReset.EN == "" {
		return EmailConfig{}, fmt.Errorf("email config: PASSWORD_RESET_EMAIL_TEMPLATE_EN_ID is required")
	}
	if cfg.TemplatePasswordReset.ES == "" {
		return EmailConfig{}, fmt.Errorf("email config: PASSWORD_RESET_EMAIL_TEMPLATE_ES_ID is required")
	}
	return cfg, nil
}
