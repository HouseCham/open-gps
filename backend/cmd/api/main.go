package main

import (
	"context"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3/log"

	"github.com/HouseCham/gps-tracker/backend/internal/app/access"
	"github.com/HouseCham/gps-tracker/backend/internal/app/apikeys"
	"github.com/HouseCham/gps-tracker/backend/internal/app/devices"
	"github.com/HouseCham/gps-tracker/backend/internal/app/locations"
	"github.com/HouseCham/gps-tracker/backend/internal/app/passwordreset"
	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/auth"
	"github.com/HouseCham/gps-tracker/backend/internal/config"
	"github.com/HouseCham/gps-tracker/backend/internal/infra/postgres"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/handlers"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/ports"
	"github.com/HouseCham/gps-tracker/backend/internal/app/email"
	"github.com/resend/resend-go/v3"
)

func main() {
	config.LoadEnv()
	log.Info("Starting server...")
	addr := ""
	if v := os.Getenv("API_PORT"); v != "" {
		port, err := strconv.ParseUint(v, 10, 64)
		if err != nil {
			log.Warn("parse API_PORT, falling back to server default", "value", v, "err", err)
		} else {
			addr = ":" + strconv.FormatUint(port, 10)
		}
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	startCtx, startCancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := postgres.NewPool(startCtx, dsn)
	startCancel()
	if err != nil {
		log.Error("create db pool", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	//-- devices
	devicesRepo := postgres.NewDevicesAdapter(pool)
	devicesService := devices.New(devicesRepo)
	//-- users
	usersRepo := postgres.NewUsersAdapter(pool)

	//-- auth (Authula). Reads AUTHULA_SECRET and AUTHULA_BASE_URL
	// from the env. Migrations run on first init.
	authCfg, err := config.LoadAuthConfig()
	if err != nil {
		log.Error("load auth config", "err", err)
		os.Exit(1)
	}
	var googleOAuth *auth.GoogleOAuthConfig
	if authCfg.GoogleOAuth != nil {
		googleOAuth = &auth.GoogleOAuthConfig{
			ClientID:     authCfg.GoogleOAuth.ClientID,
			ClientSecret: authCfg.GoogleOAuth.ClientSecret,
		}
	}
	// Flip the session cookie's `secure` flag on whenever we're
	// running in production. APP_ENV=development (the default) keeps
	// it off so contributors running without HTTPS can still sign in.
	secure := auth.IsProduction()
	authInstance, err := auth.Bootstrap(context.Background(), auth.Config{
		AppName:       authCfg.AppName,
		BaseURL:       authCfg.BaseURL,
		Secret:        authCfg.Secret,
		DatabaseURL:   authCfg.DatabaseURL,
		GoogleOAuth:   googleOAuth,
		SecureCookies: &secure,
	})
	if err != nil {
		log.Error("bootstrap auth", "err", err)
		os.Exit(1)
	}

	userCreator := authInstance.NewUserCreator()
	usersService := users.NewService(usersRepo, userCreator)

	// After-signup sync: Authula owns credentials, we own the
	// application-level projection (role, must_change_password, FKs).
	// Mirror every new Authula user into our local users table so the
	// unauthenticated bootstrap endpoint sees a non-empty table on
	// the first request after sign-up. LazyUser lookup is the safety
	// net if the hook ever fails.
	authInstance.RegisterHook(auth.SignupMirrorHook(authInstance, usersService))

	//-- access
	accessRepo := postgres.NewAccessAdapter(pool)
	accessService := access.NewAccessService(accessRepo, usersRepo)

	//-- api keys (IoT device auth)
	apiKeysAdapter := apikeys.NewAdapter(pool)
	apiKeysService := apikeys.New(apiKeysAdapter, apiKeysAdapter)

	//-- locations (IoT device ingest + read use cases)
	// The same adapter instance satisfies both Writer and Reader ports;
	// the api-keys service follows the same convention.
	locationsAdapter := locations.NewAdapter(pool)
	locationsService := locations.New(locationsAdapter, locationsAdapter)

	//-- email (Resend). Config is required at startup; the loader
	//   fails the process if anything is missing.
	emailCfg, err := config.LoadEmailConfig()
	if err != nil {
		log.Error("load email config", "err", err)
		os.Exit(1)
	}
	resendClient := resend.NewClient(emailCfg.APIKey)
	emailService := email.New(resendClient, emailCfg.From, map[string]string{
		"en": emailCfg.TemplateWelcome.EN,
		"es": emailCfg.TemplateWelcome.ES,
	}, map[string]string{
		"en": emailCfg.TemplatePasswordReset.EN,
		"es": emailCfg.TemplatePasswordReset.ES,
	})

	//-- password recovery
	passwordResetTokens := postgres.NewPasswordResetTokensAdapter(pool)
	passwordResetService := passwordreset.New(
		passwordResetTokens,
		passwordResetTokens,
		usersService,
		authInstance.NewPasswordUpdater(),
		emailService,
		nil, // default clock = time.Now
	)

	//-- queries pool — kept separate so the IoT auth middleware can
	//   use it without taking a service dependency.
	queries := postgres.New(pool)

	//-- handlers
	healthHandler := handlers.NewHealthHandler()
	devicesHandler := handlers.NewDevicesHandler(devicesService, accessService)
	passwordUpdater := authInstance.NewPasswordUpdater()
	sessionManager := authInstance.NewSessionManager()
	usersHandler := handlers.NewUsersHandler(usersService, devicesService, passwordUpdater, sessionManager)
	accessHandler := handlers.NewAccessHandler(accessService)
	apiKeysHandler := handlers.NewAPIKeysHandler(apiKeysService)
	locationsHandler := handlers.NewLocationsHandler(locationsService)
	emailHandler := handlers.NewEmailHandler(emailService)
	passwordResetHandler := handlers.NewPasswordResetHandler(passwordResetService)

	app := http.NewRouter(http.RouterDeps{
		HealthHandler:        healthHandler,
		DevicesHandler:       devicesHandler,
		UsersHandler:         usersHandler,
		AccessHandler:        accessHandler,
		APIKeysHandler:       apiKeysHandler,
		LocationsHandler:     locationsHandler,
		EmailHandler:         emailHandler,
		PasswordResetHandler: passwordResetHandler,
		BootstrapHandler:     handlers.NewBootstrapHandler(usersService),
		AccessService:     accessService,
		UsersService:      usersService,
		Queries:           queries,
		AuthHandler:       authInstance.Handler(),
		SessionCookieName: authInstance.CookieName(),
		AuthSession:       authInstance.NewSessionAuthenticator(),
		AuthUserLookup:    authInstance.NewUserLookup().(ports.UserLookup),
		SessionManager:    sessionManager,
		CORSOrigins:       config.LoadCORSOrigins(),
	})

	server := http.NewServer(app, http.ServerConfig{
		Addr:            addr,
		ShutdownTimeout: 30 * time.Second,
	})

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := server.Run(ctx); err != nil {
		log.Error("server error", "err", err)
		os.Exit(1)
	}
}
