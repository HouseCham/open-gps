package dto

// SendWelcomeEmailRequest is the JSON body for POST /api/v1/email/welcome.
// The client already knows the recipient's name and the temporary
// password (because the same admin form that calls POST /api/v1/users
// rendered them); the server only forwards them to Resend.
type SendWelcomeEmailRequest struct {
	Email             string `json:"email"              validate:"required,email"`
	FirstName         string `json:"first_name"         validate:"required,min=1,max=100"`
	TemporaryPassword string `json:"temporary_password" validate:"required,min=1,max=255"`
	Subject           string `json:"subject"            validate:"required,min=1,max=200"`
	// Language is the locale code that selects the Resend template.
	// "en" -> WELCOME_EMAIL_TEMPLATE_EN_ID, "es" -> WELCOME_EMAIL_TEMPLATE_ES_ID.
	Language string `json:"locale" validate:"required,oneof=en es"`
}

// SendWelcomeEmailResponse echoes the message id returned by Resend
// so the client can correlate with the Resend dashboard for support.
type SendWelcomeEmailResponse struct {
	MessageID string `json:"message_id"`
}
