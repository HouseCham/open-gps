package httptest

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/devices"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type MockDevicesRepository struct {
	Devices           map[uuid.UUID]*domain.Device
	DevicesWithAccess map[uuid.UUID][]domain.DeviceWithAccess
	CreateErr         error
	ListErr           error
	GetErr            error
	UpdateErr         error
	DeleteErr         error
}

func NewMockDevicesRepository() *MockDevicesRepository {
	return &MockDevicesRepository{
		Devices:           make(map[uuid.UUID]*domain.Device),
		DevicesWithAccess: make(map[uuid.UUID][]domain.DeviceWithAccess),
	}
}

func (m *MockDevicesRepository) ListForUser(ctx context.Context, userID uuid.UUID) ([]domain.DeviceWithAccess, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	return m.DevicesWithAccess[userID], nil
}

func (m *MockDevicesRepository) ListForUserWithAccessPaginated(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.DeviceWithAccess, int, error) {
	if m.ListErr != nil {
		return nil, 0, m.ListErr
	}
	devices := m.DevicesWithAccess[userID]
	total := len(devices)
	if offset >= len(devices) {
		return []domain.DeviceWithAccess{}, total, nil
	}
	end := offset + limit
	if end > len(devices) {
		end = len(devices)
	}
	return devices[offset:end], total, nil
}

func (m *MockDevicesRepository) ListForUserPaginated(ctx context.Context, userID uuid.UUID, limit, offset int) ([]domain.Device, int, error) {
	if m.ListErr != nil {
		return nil, 0, m.ListErr
	}
	var result []domain.Device
	for _, d := range m.Devices {
		result = append(result, *d)
	}
	return result, len(result), nil
}

func (m *MockDevicesRepository) CountForUser(ctx context.Context, userID uuid.UUID) (int, error) {
	if m.ListErr != nil {
		return 0, m.ListErr
	}
	return len(m.DevicesWithAccess[userID]), nil
}

func (m *MockDevicesRepository) GetByIDForUser(ctx context.Context, userID, deviceID uuid.UUID) (*domain.DeviceWithAccess, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	for _, dwa := range m.DevicesWithAccess[userID] {
		if dwa.ID == deviceID {
			return &dwa, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *MockDevicesRepository) Create(ctx context.Context, input devices.CreateInput) (*domain.Device, error) {
	if m.CreateErr != nil {
		return nil, m.CreateErr
	}
	device := &domain.Device{
		ID:           uuid.New(),
		UuidFirmware: input.UuidFirmware,
		Name:         input.Name,
		VehicleType:  input.VehicleType,
		CreatedAt:    time.Now(),
	}
	m.Devices[device.ID] = device
	return device, nil
}

func (m *MockDevicesRepository) Update(ctx context.Context, deviceID uuid.UUID, input devices.UpdateInput) (*domain.Device, error) {
	if m.UpdateErr != nil {
		return nil, m.UpdateErr
	}
	device, ok := m.Devices[deviceID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	device.Name = input.Name
	if input.VehicleType != nil {
		device.VehicleType = *input.VehicleType
	}
	return device, nil
}

func (m *MockDevicesRepository) SoftDelete(ctx context.Context, deviceID uuid.UUID) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	if _, ok := m.Devices[deviceID]; !ok {
		return domain.ErrNotFound
	}
	return nil
}

type MockUsersRepository struct {
	Users        map[uuid.UUID]*domain.User
	UsersByEmail map[string]*domain.User
	Count        int
	CreateErr    error
	GetErr       error
	UpdateErr    error
	DeleteErr    error
	ListErr      error
	CountErr     error
	// HasSuperAdminResult is read only when HasSuperAdminResultSet
	// is true. When false, HasSuperAdmin returns true by default so
	// that pre-loaded users retain the role SetupUser assigned them
	// (the long-standing test assumption that the first-user rule
	// has already been satisfied by some prior state).
	HasSuperAdminResult    bool
	HasSuperAdminResultSet bool
	HasSuperAdminErr       error
	// PromoteToSuperAdminErr is returned from PromoteToSuperAdmin
	// when non-nil.
	PromoteToSuperAdminErr error
}

func NewMockUsersRepository() *MockUsersRepository {
	return &MockUsersRepository{
		Users:        make(map[uuid.UUID]*domain.User),
		UsersByEmail: make(map[string]*domain.User),
	}
}

func (m *MockUsersRepository) ListUsers(ctx context.Context, excludeUserID uuid.UUID) ([]domain.User, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	var result []domain.User
	for _, u := range m.Users {
		if u.ID != excludeUserID {
			result = append(result, *u)
		}
	}
	return result, nil
}

func (m *MockUsersRepository) GetByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	user, ok := m.Users[userID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (m *MockUsersRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	if m.GetErr != nil {
		return nil, m.GetErr
	}
	user, ok := m.UsersByEmail[email]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return user, nil
}

func (m *MockUsersRepository) CreateUser(ctx context.Context, email, name, lastname string, role domain.UserRole, mustChangePassword, emailVerified bool) (*domain.User, error) {
	if m.CreateErr != nil {
		return nil, m.CreateErr
	}
	user := &domain.User{
		ID:                 uuid.New(),
		Email:              email,
		Name:               name,
		Lastname:           lastname,
		Role:               role,
		MustChangePassword: mustChangePassword,
		EmailVerified:      emailVerified,
		CreatedAt:          time.Now(),
	}
	m.Users[user.ID] = user
	m.UsersByEmail[email] = user
	m.Count++
	return user, nil
}

func (m *MockUsersRepository) UpdateUser(ctx context.Context, userID uuid.UUID, name, lastname string) (*domain.User, error) {
	if m.UpdateErr != nil {
		return nil, m.UpdateErr
	}
	user, ok := m.Users[userID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	if name != "" {
		user.Name = name
	}
	if lastname != "" {
		user.Lastname = lastname
	}
	return user, nil
}

func (m *MockUsersRepository) SetMustChangePassword(ctx context.Context, userID uuid.UUID, mustChange bool) error {
	// no-op mock
	return nil
}

func (m *MockUsersRepository) SoftDeleteUser(ctx context.Context, userID uuid.UUID) error {
	if m.DeleteErr != nil {
		return m.DeleteErr
	}
	if _, ok := m.Users[userID]; !ok {
		return domain.ErrNotFound
	}
	delete(m.Users, userID)
	return nil
}

func (m *MockUsersRepository) CountUsers(ctx context.Context) (int, error) {
	if m.CountErr != nil {
		return 0, m.CountErr
	}
	return m.Count, nil
}

func (m *MockUsersRepository) HasSuperAdmin(ctx context.Context) (bool, error) {
	if m.HasSuperAdminErr != nil {
		return false, m.HasSuperAdminErr
	}
	// Manual override takes precedence (used by tests that want to
	// exercise the first-user promotion path).
	if m.HasSuperAdminResultSet {
		return m.HasSuperAdminResult, nil
	}
	// Default: there is always a super_admin in the test fixture, so
	// the first-user promotion never fires. This matches the long-
	// standing test assumption that pre-loaded users retain whatever
	// role SetupUser assigned them.
	for _, u := range m.Users {
		if u.Role == domain.UserRoleSuperAdmin {
			return true, nil
		}
	}
	return true, nil
}

func (m *MockUsersRepository) PromoteToSuperAdmin(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	if m.PromoteToSuperAdminErr != nil {
		return nil, m.PromoteToSuperAdminErr
	}
	user, ok := m.Users[userID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	user.Role = domain.UserRoleSuperAdmin
	user.MustChangePassword = false
	return user, nil
}

type MockAccessRepository struct {
	AccessGrants map[string]domain.AccessRole
	Grants       []domain.UserWithAccessOnDevice
	GrantErr     error
	RevokeErr    error
	ListErr      error
	GetRoleErr   error
}

func NewMockAccessRepository() *MockAccessRepository {
	return &MockAccessRepository{
		AccessGrants: make(map[string]domain.AccessRole),
	}
}

func (m *MockAccessRepository) GetRole(ctx context.Context, userID, deviceID uuid.UUID) (domain.AccessRole, error) {
	if m.GetRoleErr != nil {
		return "", m.GetRoleErr
	}
	key := userID.String() + ":" + deviceID.String()
	role, ok := m.AccessGrants[key]
	if !ok {
		return "", domain.ErrNotFound
	}
	return role, nil
}

func (m *MockAccessRepository) Grant(ctx context.Context, userID, deviceID uuid.UUID, role domain.AccessRole) (domain.Grant, error) {
	if m.GrantErr != nil {
		return domain.Grant{}, m.GrantErr
	}
	key := userID.String() + ":" + deviceID.String()
	m.AccessGrants[key] = role
	return domain.Grant{
		UserID:    userID,
		DeviceID:  deviceID,
		Role:      role,
		CreatedAt: time.Now(),
	}, nil
}

func (m *MockAccessRepository) Revoke(ctx context.Context, userID, deviceID uuid.UUID) error {
	if m.RevokeErr != nil {
		return m.RevokeErr
	}
	return nil
}

func (m *MockAccessRepository) ListUsersForDevice(ctx context.Context, deviceID uuid.UUID) ([]domain.UserWithAccessOnDevice, error) {
	if m.ListErr != nil {
		return nil, m.ListErr
	}
	return m.Grants, nil
}

type MockUserCreator struct {
	CreateErr error
}

func (m *MockUserCreator) CreateUserWithPassword(ctx context.Context, name, email, password string) error {
	return m.CreateErr
}

// MockLocationsRepository satisfies the locations Writer/Reader/LiveReader
// ports for router-level stream tests (BA-11). GetLive reports the
// requested device with no presence deadline, so the stream's presence
// timer stays parked at its hourly default.
type MockLocationsRepository struct{}

func NewMockLocationsRepository() *MockLocationsRepository {
	return &MockLocationsRepository{}
}

func (m *MockLocationsRepository) Insert(context.Context, domain.Location) error { return nil }

func (m *MockLocationsRepository) GetLatest(_ context.Context, deviceID uuid.UUID) (domain.Location, error) {
	return domain.Location{DeviceID: deviceID, RecordedAt: time.Now().UTC()}, nil
}

func (m *MockLocationsRepository) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return nil, 0, nil
}

func (m *MockLocationsRepository) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return nil, 0, false, nil
}

func (m *MockLocationsRepository) GetLive(_ context.Context, deviceID uuid.UUID, _ time.Time, _ time.Duration, _ float64) (domain.LiveLocation, error) {
	return domain.LiveLocation{DeviceID: deviceID}, nil
}
