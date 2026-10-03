package dto

// GeneratePasswordRecoveryTokenRequest is the JSON body for
// POST /api/v1/auth/generate-pwd-recovery-token.
//
// The frontend builds the full reset URL (origin + path + query,
// WITHOUT the raw token) and passes it here; the server embeds the
// freshly-generated token in the URL it sends by email. This keeps
// the server from needing to know the public origin of the app.
type GeneratePasswordRecoveryTokenRequest struct {
	Email            string `json:"email"              validate:"required,email"`
	Locale           string `json:"locale"             validate:"required,oneof=en es"`
	ResetPasswordURL string `json:"reset_password_url" validate:"required,url"`
}

// GeneratePasswordRecoveryTokenResponse echoes Resend's message id
// for support correlation. Mirrors SendWelcomeEmailResponse.
type GeneratePasswordRecoveryTokenResponse struct {
	MessageID string `json:"message_id"`
}

// ConsumePasswordRecoveryTokenRequest is the JSON body for
// POST /api/v1/auth/consume-pwd-recovery-token.
type ConsumePasswordRecoveryTokenRequest struct {
	Token       string `json:"token"        validate:"required,min=1"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}
