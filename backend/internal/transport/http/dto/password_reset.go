package dto

// GeneratePasswordRecoveryTokenRequest is the JSON body for
// POST /api/v1/auth/generate-pwd-recovery-token.
//
// The reset link is built entirely server-side from the configured
// PUBLIC_APP_ORIGIN, the request locale and a fixed path. The client
// cannot influence the link destination (anti-phishing).
type GeneratePasswordRecoveryTokenRequest struct {
	Email  string `json:"email"  validate:"required,email"`
	Locale string `json:"locale" validate:"required,oneof=en es"`
}

// ConsumePasswordRecoveryTokenRequest is the JSON body for
// POST /api/v1/auth/consume-pwd-recovery-token.
type ConsumePasswordRecoveryTokenRequest struct {
	Token       string `json:"token"        validate:"required,min=1"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}
