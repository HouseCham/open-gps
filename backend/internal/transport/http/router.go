package http

import (
	"net/http"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"github.com/gofiber/fiber/v3/middleware/cors"

	"github.com/HouseCham/gps-tracker/backend/internal/app/access"
	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/auth"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/infra/postgres"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/handlers"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/ports"
)

type RouterDeps struct {
	HealthHandler         *handlers.HealthHandler
	DevicesHandler        *handlers.DevicesHandler
	UsersHandler          *handlers.UsersHandler
	AccessHandler         *handlers.AccessHandler
	APIKeysHandler        *handlers.APIKeysHandler
	LocationsHandler      *handlers.LocationsHandler
	EmailHandler          *handlers.EmailHandler
	PasswordResetHandler  *handlers.PasswordResetHandler
	BootstrapHandler      *handlers.BootstrapHandler
	AccessService         *access.AccessService
	UsersService          *users.Service
	Queries               *postgres.Queries
	AuthHandler           http.Handler
	SessionCookieName     string
	AuthSession           ports.SessionAuthenticator
	AuthUserLookup        ports.UserLookup
	SessionManager        ports.SessionManager
	// CORSOrigins enables the CORS middleware when non-empty. Each
	// entry is an allowed origin (e.g. "http://localhost:4321"). When
	// the frontend and backend share an origin (reverse-proxied or
	// same-host) leave this nil and the middleware is skipped.
	CORSOrigins []string
}

// NewRouter creates a new fiber app and registers the routes and handlers.
func NewRouter(deps RouterDeps) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "gps-tracker-api",
		ErrorHandler: httpErrorHandler,
	})

	// CORS is opt-in: only mounted when origins are configured.
	// Must run before any route, including the Authula catch-all.
	if len(deps.CORSOrigins) > 0 {
		app.Use(cors.New(cors.Config{
			AllowOrigins:     deps.CORSOrigins,
			AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "Cookie"},
			AllowCredentials: true,
		}))
	}

	app.Get("/health", deps.HealthHandler.Handle)

	// Single session-cookie auth middleware. Replaces the old
	// (AuthJWT -> LazyUser) pair: cookie lookup + actor resolution
	// + local user materialisation all happen here, downstream code
	// reads the same LocalsKeyClaims / LocalsKeyUser locals.
	authSession := middleware.AuthSession(deps.SessionCookieName, deps.AuthSession, deps.AuthUserLookup, deps.UsersService)

	// --- Authula: sign-in, sign-up, JWKS, token refresh, etc. ---
	// Mounted as a catch-all under the Authula base path. Authula
	// returns a net/http.Handler; we adapt it to a Fiber handler
	// via fasthttp's adaptor.
	if deps.AuthHandler != nil {
		// GET /api/auth/me is served by Fiber, not Authula, because
		// Authula's validateSessionHook is PluginID-scoped and the
		// core /me route has no plugin metadata, so the actor is
		// never set and the route 401s. We have the session cookie
		// and the actor in locals already (authSession above) — just
		// project the user. Registered first so Fiber's static route
		// wins over the catch-all below.
		app.Get(auth.BasePath+"/me", authSession, deps.UsersHandler.Me)

		// Sign-out reads the token from X-Session-Token header (which the
		// frontend sends instead of the Cookie header), invalidates via
		// Authula's session service, and clears the cookie. Registered
		// before the catch-all so it takes priority over Authula's own
		// /sign-out route which requires the Cookie header.
		app.Post(auth.BasePath+"/sign-out", deps.UsersHandler.SignOut)

		authH := adaptor.HTTPHandler(deps.AuthHandler)
		app.All(auth.BasePath+"/*", authH)
	}

	// RequirePasswordChanged blocks users who haven't changed their
	// temporary password yet. Placed after AuthSession so we have
	// the domain.User available.
	requirePasswordChanged := middleware.RequirePasswordChanged()

	apiV1 := app.Group("/api/v1")

	// === System routes (public, no auth) ===
	// The bootstrap endpoint is intentionally exposed without any
	// auth middleware so the frontend can ask "is the app empty?"
	// before the user has signed in.
	apiV1.Get("/system/bootstrap", deps.BootstrapHandler.Handle)

	// RequireInitialized is mounted on the group AFTER the bootstrap
	// route, so Fiber v3 only applies it to routes registered below.
	// It blocks every other /api/v1/* request until the first user
	// exists. The Authula signup endpoint lives under /api/auth/*
	// outside this group and is unaffected.
	apiV1.Use(middleware.RequireInitialized(deps.UsersService))

	// === Devices routes ===
	// /devices/count is registered on apiV1 directly (not on the group)
	// so the static segment wins over the /:id route below — Fiber v3
	// groups register routes into the same trie in registration order,
	// and a /:id registered later still shadows a static /count when the
	// group already has a parent node for the literal segment.
	apiV1.Get("/devices/count", authSession, requirePasswordChanged, deps.DevicesHandler.Count)

	devices := apiV1.Group("/devices")
	devices.Get("/", authSession, requirePasswordChanged, deps.DevicesHandler.List)
	devices.Get("/:id", authSession, requirePasswordChanged, deps.DevicesHandler.Get)
	devices.Post("/",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.CreateDeviceRequest](),
		deps.DevicesHandler.Create,
	)
	devices.Put("/:id",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.UpdateDeviceRequest](),
		middleware.RequireDeviceRole(domain.AccessRoleEditor, deps.AccessService),
		deps.DevicesHandler.Update,
	)
	devices.Delete("/:id",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.DevicesHandler.Delete,
	)
	devices.Post("/:id/access",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.GrantAccessRequest](),
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.AccessHandler.Grant,
	)
	devices.Get("/:id/access",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.AccessHandler.List,
	)
	devices.Delete("/:id/access/:userId",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.AccessHandler.Revoke,
	)

	// === Device API keys (owner-only) ===
	// Issue / list / revoke the IoT lookup token the firmware ships.
	// The plain token is returned by POST only — GET / DELETE never
	// surface it.
	devices.Post("/:id/api-keys",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.APIKeysHandler.Create,
	)
	devices.Get("/:id/api-keys",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.APIKeysHandler.List,
	)
	devices.Delete("/:id/api-keys/:keyId",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, deps.AccessService),
		deps.APIKeysHandler.Revoke,
	)

	// === Global api-keys admin listing ===
	// Flat list of every active key across every device the caller has
	// access to, joined with the owning device's display name. Mounted
	// on `apiV1` (not the `devices` group) because there is no :id in
	// the URL — the per-device gating middleware requires one. The
	// user_id filter inside the SQL is the access control.
	apiV1.Get("/api-keys",
		authSession,
		requirePasswordChanged,
		deps.APIKeysHandler.ListAll,
	)

	// === IoT ingest ===
	// Public to devices (no session cookie). Auth is X-Device-API-Key
	// resolved against the :uuid_firmware in the URL. Registered on
	// `app` (not the devices group) because the devices group is
	// gated by authSession — devices use a different auth path.
	//
	// Fiber v3 group caveat: a /:uuid_firmware route registered here
	// shadows any /:id sibling on the same prefix, so the literal
	// path "/locations" lives on this group instead of the devices
	// session group.
	apiV1.Post("/devices/:uuid_firmware/locations",
		middleware.RequireDeviceAPIKey(deps.Queries),
		middleware.ValidateRequestBody[dto.IngestLocationRequest](),
		deps.LocationsHandler.Ingest,
	)

	// === Location read ===
	// Session-cookie + per-device RBAC (viewer or higher). Lives on
	// the `devices` group so the standard authSession +
	// RequireDeviceRole pipeline applies. The paginated history
	// endpoint accepts a local time range and IANA timezone.
	devices.Get("/:id/locations",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleViewer, deps.AccessService),
		deps.LocationsHandler.History,
	)
	devices.Get("/:id/locations/route",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleViewer, deps.AccessService),
		deps.LocationsHandler.Route,
	)
	devices.Get("/:id/locations/latest",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleViewer, deps.AccessService),
		deps.LocationsHandler.Latest,
	)

	// === Users routes ===
	users := apiV1.Group("/users")
	users.Get("/",
		authSession,
		requirePasswordChanged,
		middleware.RequireUserRole(domain.UserRoleSuperAdmin),
		deps.UsersHandler.List,
	)
	// /users/me is registered on apiV1 directly (not on the group) so
	// the static segment wins over the /:id route below. Same Fiber v3
	// routing constraint as /devices/count above.
	apiV1.Get("/users/me", authSession, requirePasswordChanged, deps.UsersHandler.GetMe)
	users.Get("/:id", authSession, requirePasswordChanged, deps.UsersHandler.GetByID)
	users.Post("/",
		authSession,
		requirePasswordChanged,
		middleware.RequireUserRole(domain.UserRoleSuperAdmin),
		middleware.ValidateRequestBody[dto.CreateUserRequest](),
		deps.UsersHandler.Create,
	)
	users.Put("/:id",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.UpdateUserRequest](),
		deps.UsersHandler.Update,
	)
	users.Delete("/:id", authSession, requirePasswordChanged, deps.UsersHandler.Delete)

	// === Auth-related routes (application-level) ===
	// Change-password endpoint is exempt from requirePasswordChanged
	// so users with must_change_password = true can update it.
	authAPI := apiV1.Group("/auth")
	authAPI.Post("/change-password",
		authSession,
		middleware.ValidateRequestBody[dto.ChangePasswordRequest](),
		deps.UsersHandler.ChangePassword,
	)

	// === Email routes ===
	// Welcome email dispatch. super_admin only — the same gate that
	// produces the temporary password on POST /api/v1/users. Lives
	// at /api/v1/email/welcome so the URL reads as the resource
	// being acted on (the welcome dispatch) rather than a verb.
	email := apiV1.Group("/email")
	email.Post("/welcome",
		authSession,
		requirePasswordChanged,
		middleware.RequireUserRole(domain.UserRoleSuperAdmin),
		middleware.ValidateRequestBody[dto.SendWelcomeEmailRequest](),
		deps.EmailHandler.SendWelcome,
	)

	// === Password recovery (public) ===
	// Two endpoints, both unauthenticated: a user who has lost their
	// password cannot sign in to recover it. RequireInitialized still
	// applies (the user would be sent to the bootstrap page otherwise),
	// so the reset flow is only reachable after the first user exists.
	// Both endpoints live under /api/v1/auth/* so they share a path
	// group with /change-password above.
	authAPI.Post("/generate-pwd-recovery-token",
		middleware.ValidateRequestBody[dto.GeneratePasswordRecoveryTokenRequest](),
		deps.PasswordResetHandler.GenerateRecoveryToken,
	)
	authAPI.Post("/consume-pwd-recovery-token",
		middleware.ValidateRequestBody[dto.ConsumePasswordRecoveryTokenRequest](),
		deps.PasswordResetHandler.ConsumeRecoveryToken,
	)

	return app
}
