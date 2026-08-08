// Package auth wires the Authula authentication library into the API.
//
// Authula runs in embedded library mode inside the same process as the API.
// It owns its own Postgres-backed tables (users, sessions, accounts,
// verifications) which live alongside our app tables in the same database.
// The integration is intentionally thin: we mount Authula's HTTP handler
// at /api/auth/* and consume two services from its registry (SessionService
// + UserService) to power our own Fiber middleware, rather than letting
// Authula drive middleware on Fiber routes directly.
//
// Authentication is cookie-only: Authula's session plugin sets an
// HTTP-only `authula.session_token` cookie on sign-in / sign-up, and the
// cookie is the only thing that authorises subsequent requests. The
// frontend never sees a token.
//
// Our own `users` table remains the source of truth for the local
// projection (role, name, lastname, FK relationships to devices/access
// grants). It is populated lazily on first authenticated request, with
// the link between an Authula user and our local user being the email
// address (already UNIQUE in our schema).
package auth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v3"

	authula "github.com/Authula/authula"
	authulaconfig "github.com/Authula/authula/config"
	"github.com/Authula/authula/env"
	"github.com/Authula/authula/models"
	emailpasswordplugin "github.com/Authula/authula/plugins/email-password"
	emailpasswordplugintypes "github.com/Authula/authula/plugins/email-password/types"
	oauth2plugin "github.com/Authula/authula/plugins/oauth2"
	oauth2plugintypes "github.com/Authula/authula/plugins/oauth2/types"
	sessionplugin "github.com/Authula/authula/plugins/session"
	authulaservices "github.com/Authula/authula/services"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/ports"
)

// BasePath is the URL prefix where Authula's own routes (sign-in,
// sign-up, JWKS, token refresh, etc.) are mounted. Mounted under the
// /api prefix to keep the surface area namespaced.
const BasePath = "/api/auth"

// Config carries the runtime configuration consumed by Bootstrap.
type Config struct {
	// AppName is shown in Authula logs and metadata. Defaults to
	// "gps-tracker-api" when empty.
	AppName string
	// BaseURL is the public origin of the API. Used by Authula to
	// build redirect/email links. Falls back to the AUTHULA_BASE_URL
	// environment variable, then to "http://localhost:8080".
	BaseURL string
	// Secret is the symmetric secret used to encrypt sensitive
	// fields at rest. MUST be set; we fail fast during Bootstrap
	// if it is empty.
	Secret string
	// DatabaseURL is a postgres:// connection string. The same DB
	// used by the main app; Authula will create its own tables on
	// first init.
	DatabaseURL string
	// GoogleOAuth holds the Google OAuth2 provider credentials. When
	// non-nil, the OAuth2 plugin is enabled and registered for the
	// "google" provider. The RedirectURL is built automatically as
	// <BaseURL><BasePath>/oauth2/callback/google when empty.
	GoogleOAuth *GoogleOAuthConfig
	// SecureCookies overrides the `secure` flag on the session
	// cookie. When nil, Authula's config.toml value is used. When
	// non-nil, true forces Secure=true regardless of environment
	// (use this in production deployments).
	SecureCookies *bool
}

// GoogleOAuthConfig carries the credentials for the Google OAuth2
// provider. Mirrors the field names expected by Authula's oauth2
// plugin.
type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

// Auth is the composition root for Authula. It exposes the bits of
// the Authula surface that the rest of the application needs.
type Auth struct {
	instance        *authula.Auth
	cookieName      string
	sessionService  authulaservices.SessionService
	tokenService    authulaservices.TokenService
	userService     authulaservices.UserService
	accountService  authulaservices.AccountService
	passwordService authulaservices.PasswordService
}

// Bootstrap initializes Authula: it runs core + plugin migrations
// (idempotent) and registers the email-password, session, and OAuth2
// plugins. The returned *Auth is safe to call Handler() /
// NewSessionAuthenticator() / NewUserLookup() on for the rest of the
// process lifetime.
func Bootstrap(ctx context.Context, cfg Config) (*Auth, error) {
	if cfg.Secret == "" {
		return nil, fmt.Errorf("auth: AUTHULA_SECRET is required")
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("auth: DatabaseURL is required")
	}

	appName := cfg.AppName
	if appName == "" {
		appName = "gps-tracker-api"
	}

	// Make AUTHULA_DATABASE_URL visible to the internal bootstrap
	// step that opens the Bun connection. The WithDatabase option
	// falls back to it when no URL is provided directly to the
	// config, so we set it here to keep wiring in one place.
	if err := setEnvIfEmpty(env.EnvDatabaseURL, cfg.DatabaseURL); err != nil {
		return nil, fmt.Errorf("auth: failed to set %s: %w", env.EnvDatabaseURL, err)
	}

	// Build the OAuth2 plugin config only when Google is wired. The
	// plugin is intentionally opt-in: leaving GoogleOAuth nil keeps
	// the surface area exactly what it was before and means existing
	// deployments don't get extra routes mounted.
	var oauth2Cfg *oauth2plugintypes.OAuth2PluginConfig
	if cfg.GoogleOAuth != nil {
		redirectURL := cfg.GoogleOAuth.RedirectURL
		if redirectURL == "" {
			base := cfg.BaseURL
			if base == "" {
				base = "http://localhost:8080"
			}
			redirectURL = base + BasePath + "/oauth2/callback/google"
		}
		oauth2Cfg = &oauth2plugintypes.OAuth2PluginConfig{
			Enabled: true,
			Providers: map[string]oauth2plugintypes.ProviderConfig{
				"google": {
					Enabled:      true,
					ClientID:     cfg.GoogleOAuth.ClientID,
					ClientSecret: cfg.GoogleOAuth.ClientSecret,
					RedirectURL:  redirectURL,
				},
			},
		}
	}

	authulaCfg := authulaconfig.NewConfig(
		authulaconfig.WithAppName(appName),
		authulaconfig.WithBaseURL(cfg.BaseURL),
		authulaconfig.WithBasePath(BasePath),
		authulaconfig.WithSecret(cfg.Secret),
		authulaconfig.WithDatabase(models.DatabaseConfig{
			Provider: "postgres",
			URL:      cfg.DatabaseURL,
		}),
		authulaconfig.WithPlugins(models.PluginsConfig{
			models.PluginEmailPassword.String(): &emailpasswordplugintypes.EmailPasswordPluginConfig{
				Enabled:    true,
				AutoSignIn: true,
			},
			models.PluginSession.String(): &sessionplugin.SessionPluginConfig{
				Enabled: true,
			},
		}),
	)

	// The explicit SecureCookies override (driven by APP_ENV in main)
	// takes precedence over whatever Authula picked up from TOML.
	if cfg.SecureCookies != nil {
		authulaCfg.Session.Secure = *cfg.SecureCookies
	}

	plugins := []models.Plugin{
		emailpasswordplugin.New(emailpasswordplugintypes.EmailPasswordPluginConfig{
			Enabled:    true,
			AutoSignIn: true,
		}),
		sessionplugin.New(sessionplugin.SessionPluginConfig{
			Enabled: true,
		}),
	}
	if oauth2Cfg != nil {
		plugins = append(plugins, oauth2plugin.New(*oauth2Cfg))
	}

	instance := authula.New(&authula.AuthConfig{
		Config:  authulaCfg,
		Plugins: plugins,
	})

	// Pre-warm the handler so route registration + plugin init
	// happen eagerly (and panic on misconfiguration here rather
	// than on first request).
	_ = instance.Handler()

	sessionSvc, ok := instance.ServiceRegistry.Get(models.ServiceSession.String()).(authulaservices.SessionService)
	if !ok {
		return nil, fmt.Errorf("auth: session service not registered by core services")
	}

	tokenSvc, ok := instance.ServiceRegistry.Get(models.ServiceToken.String()).(authulaservices.TokenService)
	if !ok {
		return nil, fmt.Errorf("auth: token service not registered by core services")
	}

	userSvc, ok := instance.ServiceRegistry.Get(models.ServiceUser.String()).(authulaservices.UserService)
	if !ok {
		return nil, fmt.Errorf("auth: user service not registered by core services")
	}

	accountSvc, ok := instance.ServiceRegistry.Get(models.ServiceAccount.String()).(authulaservices.AccountService)
	if !ok {
		return nil, fmt.Errorf("auth: account service not registered by core services")
	}

	passwordSvc, ok := instance.ServiceRegistry.Get(models.ServicePassword.String()).(authulaservices.PasswordService)
	if !ok {
		return nil, fmt.Errorf("auth: password service not registered by core services")
	}

	return &Auth{
		instance:        instance,
		cookieName:      authulaCfg.Session.CookieName,
		sessionService:  sessionSvc,
		tokenService:    tokenSvc,
		userService:     userSvc,
		accountService:  accountSvc,
		passwordService: passwordSvc,
	}, nil
}

// Handler returns the net/http handler that serves all Authula routes
// (sign-in, sign-up, JWKS, token refresh, etc.). Mount it under
// BasePath via Fiber's adaptor.HTTPHandler.
func (a *Auth) Handler() http.Handler {
	return a.instance.Handler()
}

// CookieName returns the name of the HTTP-only session cookie that
// Authula's session plugin reads and writes. The middleware looks the
// value up on the Fiber request with this name.
func (a *Auth) CookieName() string {
	return a.cookieName
}

// NewSessionAuthenticator returns a value that resolves an Authula
// actor from a raw session token (the unhashed value of the session
// cookie). Hashing + session lookup + expiry check are encapsulated
// here so the middleware can stay transport-only.
func (a *Auth) NewSessionAuthenticator() sessionAuthenticator {
	return sessionAuthenticator{
		sessionSvc: a.sessionService,
		tokenSvc:   a.tokenService,
	}
}

// NewUserLookup returns the live Authula core user service.
func (a *Auth) NewUserLookup() authulaservices.UserService {
	return a.userService
}

// NewUserCreator returns a creator backed by the live Authula services.
func (a *Auth) NewUserCreator() authulaUserCreator {
	return authulaUserCreator{
		userService:    a.userService,
		accountService: a.accountService,
		passwordService: a.passwordService,
	}
}

type authulaUserCreator struct {
	userService    authulaservices.UserService
	accountService authulaservices.AccountService
	passwordService authulaservices.PasswordService
}

func (c authulaUserCreator) CreateUserWithPassword(ctx context.Context, name, email, password string) error {
	hash, err := c.passwordService.Hash(password)
	if err != nil {
		return fmt.Errorf("auth: hash password: %w", err)
	}
	user, err := c.userService.Create(ctx, name, email, true, nil, nil)
	if err != nil {
		return fmt.Errorf("auth: create user: %w", err)
	}
	_, err = c.accountService.Create(ctx, user.ID, email, models.AuthProviderEmail.String(), &hash)
	if err != nil {
		return fmt.Errorf("auth: create account: %w", err)
	}
	return nil
}

// RegisterHook exposes Authula's hook registration. The caller is
// the composition root and decides what to do with the new
// RequestContext. Must be called after Bootstrap and before the
// first request reaches Handler().
func (a *Auth) RegisterHook(hook models.Hook) {
	a.instance.RegisterHook(hook)
}

// NewPasswordUpdater returns an updater backed by the live Authula services.
func (a *Auth) NewPasswordUpdater() authulaPasswordUpdater {
	return authulaPasswordUpdater{
		accountService:  a.accountService,
		passwordService: a.passwordService,
	}
}

type authulaPasswordUpdater struct {
	accountService  authulaservices.AccountService
	passwordService authulaservices.PasswordService
}

func (u authulaPasswordUpdater) UpdatePassword(ctx context.Context, authulaUserID, oldPassword, newPassword string) error {
	account, err := u.accountService.GetByUserID(ctx, authulaUserID)
	if err != nil {
		return fmt.Errorf("auth: get account: %w", err)
	}
	if account.Password == nil || !u.passwordService.Verify(oldPassword, *account.Password) {
		return fmt.Errorf("%w: current password is incorrect", domain.ErrInvalidCredentials)
	}
	hash, err := u.passwordService.Hash(newPassword)
	if err != nil {
		return fmt.Errorf("auth: hash password: %w", err)
	}
	err = u.accountService.UpdateFields(ctx, authulaUserID, map[string]any{"password": hash})
	if err != nil {
		return fmt.Errorf("auth: update account password: %w", err)
	}
	return nil
}

// ResetPassword overwrites the Authula account password without
// verifying the old one. Used by the password-reset flow after the
// caller has validated a one-time reset token. The local
// must_change_password flag is NOT touched here — the caller (the
// passwordreset service) clears it on the local users table.
func (u authulaPasswordUpdater) ResetPassword(ctx context.Context, authulaUserID, newPassword string) error {
	hash, err := u.passwordService.Hash(newPassword)
	if err != nil {
		return fmt.Errorf("auth: hash password: %w", err)
	}
	if err := u.accountService.UpdateFields(ctx, authulaUserID, map[string]any{"password": hash}); err != nil {
		return fmt.Errorf("auth: update account password: %w", err)
	}
	return nil
}

func (a *Auth) NewSessionManager() ports.SessionManager {
	return authulaSessionManager{
		sessionSvc: a.sessionService,
		tokenSvc:   a.tokenService,
		cookieName: a.cookieName,
	}
}

type authulaSessionManager struct {
	sessionSvc authulaservices.SessionService
	tokenSvc   authulaservices.TokenService
	cookieName string
}

func (m authulaSessionManager) Invalidate(ctx context.Context, sessionToken string) error {
	if sessionToken == "" {
		return nil
	}
	hashed := m.tokenSvc.Hash(sessionToken)
	return m.sessionSvc.Delete(ctx, hashed)
}

func (m authulaSessionManager) ClearCookie(c fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     m.cookieName,
		Value:    "",
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   parseAppEnv() == "production",
		SameSite: "Lax",
	})
}

// sessionAuthenticator is the production-side implementation of
// ports.SessionAuthenticator. It hashes the raw cookie value with
// Authula's TokenService, looks up the matching session row, and
// returns the actor bound to it. Expired sessions are treated as
// missing — the same way the session plugin treats them on its own
// validate hook.
type sessionAuthenticator struct {
	sessionSvc authulaservices.SessionService
	tokenSvc   authulaservices.TokenService
}

func (a sessionAuthenticator) Authenticate(ctx context.Context, sessionToken string) (*models.Actor, error) {
	if sessionToken == "" {
		return nil, nil
	}
	hashed := a.tokenSvc.Hash(sessionToken)
	session, err := a.sessionSvc.GetByToken(ctx, hashed)
	if err != nil || session == nil {
		return nil, nil
	}
	if session.ExpiresAt.Before(timeNow()) {
		return nil, nil
	}
	return &models.Actor{ID: session.UserID, Type: models.ActorUser}, nil
}

// timeNow is a package-level seam so the middleware can be tested
// with a frozen clock without dragging in a clockwork-style
// dependency.
var timeNow = func() time.Time { return time.Now().UTC() }

// IsProduction reports whether the process is running in production.
// It is read from APP_ENV (case-insensitive) so deployments can flip
// production-only behaviour (HSTS, secure cookies, strict CORS, etc.)
// via a single env var without code changes.
func IsProduction() bool {
	return parseAppEnv() == "production"
}

// parseAppEnv returns the lower-cased APP_ENV value, defaulting to
// "development" when unset. Split out for tests that need to assert
// the parser itself.
func parseAppEnv() string {
	v := os.Getenv("APP_ENV")
	if v == "" {
		return "development"
	}
	return lower(v)
}

func lower(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}