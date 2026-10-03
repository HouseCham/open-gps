package httptest

import (
	"context"
	"errors"
	"time"

	"github.com/Authula/authula/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/access"
	"github.com/HouseCham/gps-tracker/backend/internal/app/devices"
	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/handlers"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
)

type TestApp struct {
	App               *fiber.App
	SessionAuth       *MockSessionAuthenticator
	UserLookup        *MockUserLookup
	HealthHandler     *handlers.HealthHandler
	PasswordUpdater   *MockPasswordUpdater
	SessionManager    *MockSessionManager
	DevicesRepo       *MockDevicesRepository
	UsersRepo         *MockUsersRepository
	AccessRepo        *MockAccessRepository
	DevicesService    *devices.Service
	UsersService      *users.Service
	AccessService     *access.AccessService
	DevicesHandler    *handlers.DevicesHandler
	UsersHandler      *handlers.UsersHandler
	AccessHandler     *handlers.AccessHandler
	SessionCookieName string
}

type TestAppOption func(*TestApp)

func WithDevicesRepo(repo *MockDevicesRepository) TestAppOption {
	return func(ta *TestApp) {
		ta.DevicesRepo = repo
	}
}

func WithUsersRepo(repo *MockUsersRepository) TestAppOption {
	return func(ta *TestApp) {
		ta.UsersRepo = repo
	}
}

func WithAccessRepo(repo *MockAccessRepository) TestAppOption {
	return func(ta *TestApp) {
		ta.AccessRepo = repo
	}
}

func NewTestApp(opts ...TestAppOption) *TestApp {
	ta := &TestApp{
		SessionAuth:       NewMockSessionAuthenticator(),
		UserLookup:        NewMockUserLookup(),
		PasswordUpdater:   &MockPasswordUpdater{},
		SessionManager:    &MockSessionManager{},
		DevicesRepo:       NewMockDevicesRepository(),
		UsersRepo:         NewMockUsersRepository(),
		AccessRepo:        NewMockAccessRepository(),
		SessionCookieName: "authula.session_token",
	}

	for _, opt := range opts {
		opt(ta)
	}

	ta.DevicesService = devices.New(ta.DevicesRepo)
	ta.UsersService = users.NewService(ta.UsersRepo, &MockUserCreator{})
	ta.AccessService = access.NewAccessService(ta.AccessRepo, ta.UsersRepo)

	ta.App = fiber.New(fiber.Config{
		AppName:      "gps-tracker-test",
		ErrorHandler: httpErrorHandler,
	})

	ta.registerRoutes()
	return ta
}

func (ta *TestApp) registerRoutes() {
	ta.HealthHandler = handlers.NewHealthHandler()
	ta.App.Get("/health", ta.HealthHandler.Handle)

	authSession := middleware.AuthSession(ta.SessionCookieName, ta.SessionAuth, ta, ta.UsersService)

	// Mirrors the production router: GET /api/auth/me is served by
	// Fiber (not by an Authula catch-all) so the request uses our
	// own session middleware instead of relying on Authula's
	// PluginID-scoped validateSessionHook.
	ta.App.Get("/api/auth/me", authSession, ta.getUsersHandler().Me)
	requirePasswordChanged := middleware.RequirePasswordChanged()

	apiV1 := ta.App.Group("/api/v1")

	apiV1.Get("/devices/count", authSession, requirePasswordChanged, ta.getDevicesHandler().Count)

	devicesGroup := apiV1.Group("/devices")
	devicesGroup.Get("/", authSession, requirePasswordChanged, ta.getDevicesHandler().List)
	devicesGroup.Get("/:id", authSession, requirePasswordChanged, ta.getDevicesHandler().Get)
	devicesGroup.Post("/",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.CreateDeviceRequest](),
		ta.getDevicesHandler().Create,
	)
	devicesGroup.Put("/:id",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.UpdateDeviceRequest](),
		middleware.RequireDeviceRole(domain.AccessRoleEditor, ta.AccessService),
		ta.getDevicesHandler().Update,
	)
	devicesGroup.Delete("/:id",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, ta.AccessService),
		ta.getDevicesHandler().Delete,
	)
	devicesGroup.Post("/:id/access",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.GrantAccessRequest](),
		middleware.RequireDeviceRole(domain.AccessRoleOwner, ta.AccessService),
		ta.getAccessHandler().Grant,
	)
	devicesGroup.Get("/:id/access",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, ta.AccessService),
		ta.getAccessHandler().List,
	)
	devicesGroup.Delete("/:id/access/:userId",
		authSession,
		requirePasswordChanged,
		middleware.RequireDeviceRole(domain.AccessRoleOwner, ta.AccessService),
		ta.getAccessHandler().Revoke,
	)

	usersGroup := apiV1.Group("/users")
	usersGroup.Get("/",
		authSession,
		requirePasswordChanged,
		middleware.RequireUserRole(domain.UserRoleSuperAdmin),
		ta.getUsersHandler().List,
	)
	// /api/v1/users/me mirrors the same Fiber v3 routing constraint as
	// /devices/count above.
	apiV1.Get("/users/me", authSession, requirePasswordChanged, ta.getUsersHandler().GetMe)
	usersGroup.Get("/:id", authSession, requirePasswordChanged, ta.getUsersHandler().GetByID)
	usersGroup.Post("/",
		authSession,
		requirePasswordChanged,
		middleware.RequireUserRole(domain.UserRoleSuperAdmin),
		middleware.ValidateRequestBody[dto.CreateUserRequest](),
		ta.getUsersHandler().Create,
	)
	usersGroup.Put("/:id",
		authSession,
		requirePasswordChanged,
		middleware.ValidateRequestBody[dto.UpdateUserRequest](),
		ta.getUsersHandler().Update,
	)
	usersGroup.Delete("/:id", authSession, requirePasswordChanged, ta.getUsersHandler().Delete)

	authGroup := apiV1.Group("/auth")
	authGroup.Post("/change-password",
		authSession,
		middleware.ValidateRequestBody[dto.ChangePasswordRequest](),
		ta.getUsersHandler().ChangePassword,
	)
}

func (ta *TestApp) getDevicesHandler() *handlers.DevicesHandler {
	if ta.DevicesHandler == nil {
		ta.DevicesHandler = handlers.NewDevicesHandler(ta.DevicesService, ta.AccessService)
	}
	return ta.DevicesHandler
}

func (ta *TestApp) getUsersHandler() *handlers.UsersHandler {
	if ta.UsersHandler == nil {
		ta.UsersHandler = handlers.NewUsersHandler(ta.UsersService, ta.DevicesService, ta.PasswordUpdater, ta.SessionManager)
	}
	return ta.UsersHandler
}

func (ta *TestApp) getAccessHandler() *handlers.AccessHandler {
	if ta.AccessHandler == nil {
		ta.AccessHandler = handlers.NewAccessHandler(ta.AccessService)
	}
	return ta.AccessHandler
}

func httpErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "internal server error"

	var fe *fiber.Error
	if errors.As(err, &fe) {
		code = fe.Code
		message = fe.Message
	} else if errors.Is(err, domain.ErrNotFound) {
		code = fiber.StatusNotFound
		message = "not found"
	} else if errors.Is(err, domain.ErrUnauthorized) {
		code = fiber.StatusUnauthorized
		message = "unauthorized"
	} else if errors.Is(err, domain.ErrForbidden) {
		code = fiber.StatusForbidden
		message = "forbidden"
	} else if errors.Is(err, domain.ErrCannotRevokeSelf) {
		code = fiber.StatusBadRequest
		message = "cannot revoke your own device access"
	} else if errors.Is(err, domain.ErrConflict) {
		code = fiber.StatusConflict
		message = "conflict"
	} else if errors.Is(err, domain.ErrValidation) {
		code = fiber.StatusBadRequest
		message = "validation error"
	}

	return c.Status(code).JSON(response.HTTPResponse[bool]{
		StatusCode: code,
		Message:    message,
	})
}

func (ta *TestApp) GetByID(_ context.Context, id string) (*models.User, error) {
	user, ok := ta.UserLookup.Users[id]
	if !ok {
		return nil, ErrUserNotFound
	}
	return user, nil
}

type MockPasswordUpdater struct {
	UpdatedPasswords map[string]bool
	Err              error
}

func (m *MockPasswordUpdater) UpdatePassword(_ context.Context, _, _, _ string) error {
	if m.Err != nil {
		return m.Err
	}
	if m.UpdatedPasswords == nil {
		m.UpdatedPasswords = make(map[string]bool)
	}
	m.UpdatedPasswords["updated"] = true
	return nil
}

func (m *MockPasswordUpdater) ResetPassword(_ context.Context, _, _ string) error {
	if m.Err != nil {
		return m.Err
	}
	if m.UpdatedPasswords == nil {
		m.UpdatedPasswords = make(map[string]bool)
	}
	m.UpdatedPasswords["reset"] = true
	return nil
}

func (ta *TestApp) AuthActor(token string) *TestActor {
	return ta.SessionAuth.Actors[token]
}

func (ta *TestApp) AddDevice(ownerID uuid.UUID, device *domain.Device, role domain.AccessRole) {
	ta.DevicesRepo.Devices[device.ID] = device
	dwa := domain.DeviceWithAccess{
		Device:     *device,
		AccessRole: role,
	}
	ta.DevicesRepo.DevicesWithAccess[ownerID] = append(ta.DevicesRepo.DevicesWithAccess[ownerID], dwa)
	ta.AccessRepo.AccessGrants[ownerID.String()+":"+device.ID.String()] = role
}

func (ta *TestApp) AddUser(user *domain.User) {
	ta.UsersRepo.Users[user.ID] = user
	ta.UsersRepo.UsersByEmail[user.Email] = user
	ta.UsersRepo.Count++
}

func (ta *TestApp) SetupUser(token, authulaID, email, name string, role domain.UserRole) uuid.UUID {
	ta.SessionAuth.AddActor(token, &TestActor{
		ID: authulaID,
	})
	ta.UserLookup.AddUser(authulaID, &models.User{
		ID:    authulaID,
		Email: email,
		Name:  name,
	})

	userID := uuid.New()
	user := &domain.User{
		ID:        userID,
		Email:     email,
		Name:      name,
		Role:      role,
		CreatedAt: time.Now(),
	}
	ta.AddUser(user)

	return userID
}
