package access

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

var fixedTime = time.Date(2026, time.June, 14, 12, 0, 0, 0, time.UTC)

type mockRepo struct {
	getRoleFn            func(ctx context.Context, userID, deviceID uuid.UUID) (domain.AccessRole, error)
	grantFn              func(ctx context.Context, userID, deviceID uuid.UUID, role domain.AccessRole) (domain.Grant, error)
	revokeFn             func(ctx context.Context, userID, deviceID uuid.UUID) error
	listUsersForDeviceFn func(ctx context.Context, deviceID uuid.UUID) ([]domain.UserWithAccessOnDevice, error)
}

func (m *mockRepo) GetRole(ctx context.Context, userID, deviceID uuid.UUID) (domain.AccessRole, error) {
	if m.getRoleFn == nil {
		return "", errors.New("mockRepo.GetRole: not configured")
	}
	return m.getRoleFn(ctx, userID, deviceID)
}

func (m *mockRepo) Grant(ctx context.Context, userID, deviceID uuid.UUID, role domain.AccessRole) (domain.Grant, error) {
	if m.grantFn == nil {
		return domain.Grant{}, errors.New("mockRepo.Grant: not configured")
	}
	return m.grantFn(ctx, userID, deviceID, role)
}

func (m *mockRepo) Revoke(ctx context.Context, userID, deviceID uuid.UUID) error {
	if m.revokeFn == nil {
		return errors.New("mockRepo.Revoke: not configured")
	}
	return m.revokeFn(ctx, userID, deviceID)
}

func (m *mockRepo) ListUsersForDevice(ctx context.Context, deviceID uuid.UUID) ([]domain.UserWithAccessOnDevice, error) {
	if m.listUsersForDeviceFn == nil {
		return nil, errors.New("mockRepo.ListUsersForDevice: not configured")
	}
	return m.listUsersForDeviceFn(ctx, deviceID)
}

type mockUsersRepo struct {
	getByIDFn func(ctx context.Context, userID uuid.UUID) (*domain.User, error)
}

func (m *mockUsersRepo) GetByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	if m.getByIDFn == nil {
		return nil, errors.New("mockUsersRepo.GetByID: not configured")
	}
	return m.getByIDFn(ctx, userID)
}

// The remaining users.Repository methods are not exercised by access.Service.
// They are implemented as stubs so the mock satisfies the full interface.
func (m *mockUsersRepo) ListUsers(_ context.Context, _ uuid.UUID) ([]domain.User, error) {
	return nil, errors.New("mockUsersRepo.ListUsers: not configured")
}
func (m *mockUsersRepo) GetByEmail(_ context.Context, _ string) (*domain.User, error) {
	return nil, errors.New("mockUsersRepo.GetByEmail: not configured")
}
func (m *mockUsersRepo) CreateUser(_ context.Context, _, _, _ string, _ bool, _ users.DecisionFunc) (*domain.User, error) {
	return nil, errors.New("mockUsersRepo.CreateUser: not configured")
}
func (m *mockUsersRepo) UpdateUser(_ context.Context, _ uuid.UUID, _, _ string) (*domain.User, error) {
	return nil, errors.New("mockUsersRepo.UpdateUser: not configured")
}
func (m *mockUsersRepo) SoftDeleteUser(_ context.Context, _ uuid.UUID) error {
	return errors.New("mockUsersRepo.SoftDeleteUser: not configured")
}
func (m *mockUsersRepo) SetMustChangePassword(_ context.Context, _ uuid.UUID, _ bool) error {
	return errors.New("mockUsersRepo.SetMustChangePassword: not configured")
}
func (m *mockUsersRepo) CountUsers(_ context.Context) (int, error) {
	return 0, errors.New("mockUsersRepo.CountUsers: not configured")
}
func (m *mockUsersRepo) PromoteIfFirstUser(_ context.Context, _ uuid.UUID) (*domain.User, error) {
	return nil, errors.New("mockUsersRepo.PromoteIfFirstUser: not configured")
}

func TestRoleSatisfies(t *testing.T) {
	tests := []struct {
		name   string
		actual domain.AccessRole
		min    domain.AccessRole
		want   bool
	}{
		{"owner satisfies viewer", domain.AccessRoleOwner, domain.AccessRoleViewer, true},
		{"owner satisfies editor", domain.AccessRoleOwner, domain.AccessRoleEditor, true},
		{"owner satisfies owner", domain.AccessRoleOwner, domain.AccessRoleOwner, true},
		{"editor satisfies viewer", domain.AccessRoleEditor, domain.AccessRoleViewer, true},
		{"editor satisfies editor", domain.AccessRoleEditor, domain.AccessRoleEditor, true},
		{"editor does not satisfy owner", domain.AccessRoleEditor, domain.AccessRoleOwner, false},
		{"viewer satisfies viewer", domain.AccessRoleViewer, domain.AccessRoleViewer, true},
		{"viewer does not satisfy editor", domain.AccessRoleViewer, domain.AccessRoleEditor, false},
		{"viewer does not satisfy owner", domain.AccessRoleViewer, domain.AccessRoleOwner, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := RoleSatisfies(tt.actual, tt.min); got != tt.want {
				t.Errorf("RoleSatisfies(%q, %q) = %v, want %v", tt.actual, tt.min, got, tt.want)
			}
		})
	}
}

func TestRequireRole(t *testing.T) {
	userID := uuid.New()
	deviceID := uuid.New()
	ctx := context.Background()

	t.Run("allows when role satisfies minimum", func(t *testing.T) {
		svc := NewAccessService(&mockRepo{
			getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
				return domain.AccessRoleOwner, nil
			},
		}, &mockUsersRepo{})
		err := svc.RequireRole(ctx, userID, deviceID, domain.AccessRoleViewer)
		if err != nil {
			t.Errorf("expected nil, got %v", err)
		}
	})

	t.Run("forbids when role below minimum", func(t *testing.T) {
		svc := NewAccessService(&mockRepo{
			getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
				return domain.AccessRoleViewer, nil
			},
		}, &mockUsersRepo{})
		err := svc.RequireRole(ctx, userID, deviceID, domain.AccessRoleOwner)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("propagates not found from repo", func(t *testing.T) {
		svc := NewAccessService(&mockRepo{
			getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
				return "", domain.ErrNotFound
			},
		}, &mockUsersRepo{})
		err := svc.RequireRole(ctx, userID, deviceID, domain.AccessRoleViewer)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("propagates unexpected error from repo", func(t *testing.T) {
		unexpected := errors.New("connection refused")
		svc := NewAccessService(&mockRepo{
			getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
				return "", unexpected
			},
		}, &mockUsersRepo{})
		err := svc.RequireRole(ctx, userID, deviceID, domain.AccessRoleViewer)
		if !errors.Is(err, unexpected) {
			t.Errorf("expected %v, got %v", unexpected, err)
		}
	})
}

func TestGrantAccess(t *testing.T) {
	actorID := uuid.New()
	targetID := uuid.New()
	otherID := uuid.New()
	deviceID := uuid.New()
	ctx := context.Background()

	t.Run("grants viewer access and propagates the result", func(t *testing.T) {
		svc := NewAccessService(
			&mockRepo{
				grantFn: func(_ context.Context, gotUserID, gotDeviceID uuid.UUID, gotRole domain.AccessRole) (domain.Grant, error) {
					if gotUserID != targetID {
						t.Errorf("expected userID %v, got %v", targetID, gotUserID)
					}
					if gotDeviceID != deviceID {
						t.Errorf("expected deviceID %v, got %v", deviceID, gotDeviceID)
					}
					if gotRole != domain.AccessRoleViewer {
						t.Errorf("expected role viewer, got %q", gotRole)
					}
					return domain.Grant{
						UserID:    gotUserID,
						DeviceID:  gotDeviceID,
						Role:      gotRole,
						CreatedAt: fixedTime,
					}, nil
				},
			},
			&mockUsersRepo{
				getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
					if id != targetID {
						t.Errorf("expected targetID %v, got %v", targetID, id)
					}
					return &domain.User{ID: id, Email: "target@example.com"}, nil
				},
			},
		)

		grant, err := svc.GrantAccess(ctx, actorID, deviceID, targetID)
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
		if grant.UserID != targetID || grant.DeviceID != deviceID || grant.Role != domain.AccessRoleViewer {
			t.Errorf("unexpected grant: %+v", grant)
		}
		if !grant.CreatedAt.Equal(fixedTime) {
			t.Errorf("expected CreatedAt %v, got %v", fixedTime, grant.CreatedAt)
		}
	})

	t.Run("rejects self-grant with conflict", func(t *testing.T) {
		repoCalled := false
		svc := NewAccessService(
			&mockRepo{
				grantFn: func(_ context.Context, _, _ uuid.UUID, _ domain.AccessRole) (domain.Grant, error) {
					repoCalled = true
					return domain.Grant{}, nil
				},
			},
			&mockUsersRepo{
				getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
					t.Errorf("users repo should not be called for self-grant")
					return nil, nil
				},
			},
		)

		_, err := svc.GrantAccess(ctx, actorID, deviceID, actorID)
		if !errors.Is(err, domain.ErrConflict) {
			t.Errorf("expected ErrConflict, got %v", err)
		}
		if repoCalled {
			t.Errorf("expected grantFn not to be called")
		}
	})

	t.Run("rejects when target user does not exist", func(t *testing.T) {
		repoCalled := false
		svc := NewAccessService(
			&mockRepo{
				grantFn: func(_ context.Context, _, _ uuid.UUID, _ domain.AccessRole) (domain.Grant, error) {
					repoCalled = true
					return domain.Grant{}, nil
				},
			},
			&mockUsersRepo{
				getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
					return nil, domain.ErrNotFound
				},
			},
		)

		_, err := svc.GrantAccess(ctx, actorID, deviceID, otherID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
		if repoCalled {
			t.Errorf("expected grantFn not to be called when target is missing")
		}
	})

	t.Run("propagates unexpected error from users repo", func(t *testing.T) {
		unexpected := errors.New("db down")
		svc := NewAccessService(
			&mockRepo{},
			&mockUsersRepo{
				getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
					return nil, unexpected
				},
			},
		)

		_, err := svc.GrantAccess(ctx, actorID, deviceID, otherID)
		if !errors.Is(err, unexpected) {
			t.Errorf("expected %v, got %v", unexpected, err)
		}
	})
}

func TestRevokeAccess(t *testing.T) {
	actorID := uuid.New()
	targetID := uuid.New()
	ownerID := uuid.New()
	viewerID := uuid.New()
	deviceID := uuid.New()
	ctx := context.Background()

	t.Run("revokes when target is viewer", func(t *testing.T) {
		revokeCalled := false
		svc := NewAccessService(
			&mockRepo{
				getRoleFn: func(_ context.Context, gotUserID, _ uuid.UUID) (domain.AccessRole, error) {
					if gotUserID != targetID {
						t.Errorf("expected targetID %v, got %v", targetID, gotUserID)
					}
					return domain.AccessRoleViewer, nil
				},
				revokeFn: func(_ context.Context, gotUserID, gotDeviceID uuid.UUID) error {
					revokeCalled = true
					if gotUserID != targetID {
						t.Errorf("expected userID %v, got %v", targetID, gotUserID)
					}
					if gotDeviceID != deviceID {
						t.Errorf("expected deviceID %v, got %v", deviceID, gotDeviceID)
					}
					return nil
				},
			},
			&mockUsersRepo{},
		)

		if err := svc.RevokeAccess(ctx, actorID, deviceID, targetID); err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
		if !revokeCalled {
			t.Errorf("expected revokeFn to be called")
		}
	})

	t.Run("rejects self-revoke", func(t *testing.T) {
		svc := NewAccessService(
			&mockRepo{
				getRoleFn: func(_ context.Context, _ uuid.UUID, _ uuid.UUID) (domain.AccessRole, error) {
					t.Errorf("getRoleFn should not be called for self-revoke")
					return "", nil
				},
			},
			&mockUsersRepo{},
		)

		err := svc.RevokeAccess(ctx, actorID, deviceID, actorID)
		if !errors.Is(err, domain.ErrCannotRevokeSelf) {
			t.Errorf("expected ErrCannotRevokeSelf, got %v", err)
		}
	})

	t.Run("rejects revoking another owner", func(t *testing.T) {
		revokeCalled := false
		svc := NewAccessService(
			&mockRepo{
				getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
					return domain.AccessRoleOwner, nil
				},
				revokeFn: func(_ context.Context, _, _ uuid.UUID) error {
					revokeCalled = true
					return nil
				},
			},
			&mockUsersRepo{},
		)

		err := svc.RevokeAccess(ctx, actorID, deviceID, ownerID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
		if revokeCalled {
			t.Errorf("expected revokeFn not to be called when target is owner")
		}
	})

	t.Run("propagates not found from get role", func(t *testing.T) {
		svc := NewAccessService(
			&mockRepo{
				getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
					return "", domain.ErrNotFound
				},
			},
			&mockUsersRepo{},
		)

		err := svc.RevokeAccess(ctx, actorID, deviceID, viewerID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("propagates unexpected error from repo", func(t *testing.T) {
		unexpected := errors.New("connection refused")
		svc := NewAccessService(
			&mockRepo{
				getRoleFn: func(_ context.Context, _, _ uuid.UUID) (domain.AccessRole, error) {
					return "", unexpected
				},
			},
			&mockUsersRepo{},
		)

		err := svc.RevokeAccess(ctx, actorID, deviceID, viewerID)
		if !errors.Is(err, unexpected) {
			t.Errorf("expected %v, got %v", unexpected, err)
		}
	})
}

func TestListUsersForDevice(t *testing.T) {
	deviceID := uuid.New()
	ownerID := uuid.New()
	viewerID := uuid.New()
	otherID := uuid.New()
	ctx := context.Background()

	expected := []domain.UserWithAccessOnDevice{
		{UserID: ownerID, Name: "Owner", Email: "owner@example.com", AccessRole: domain.AccessRoleOwner, AccessGrantedAt: fixedTime},
		{UserID: viewerID, Name: "Viewer", Email: "viewer@example.com", AccessRole: domain.AccessRoleViewer, AccessGrantedAt: fixedTime},
		{UserID: otherID, Name: "Other", Email: "other@example.com", AccessRole: domain.AccessRoleEditor, AccessGrantedAt: fixedTime},
	}

	t.Run("passes through to the repo", func(t *testing.T) {
		svc := NewAccessService(
			&mockRepo{
				listUsersForDeviceFn: func(_ context.Context, gotDeviceID uuid.UUID) ([]domain.UserWithAccessOnDevice, error) {
					if gotDeviceID != deviceID {
						t.Errorf("expected deviceID %v, got %v", deviceID, gotDeviceID)
					}
					return expected, nil
				},
			},
			&mockUsersRepo{},
		)

		items, err := svc.ListUsersForDevice(ctx, uuid.Nil, deviceID)
		if err != nil {
			t.Fatalf("expected nil, got %v", err)
		}
		if len(items) != len(expected) {
			t.Fatalf("expected %d items, got %d", len(expected), len(items))
		}
		for i := range items {
			if items[i] != expected[i] {
				t.Errorf("item %d mismatch: got %+v, want %+v", i, items[i], expected[i])
			}
		}
	})

	t.Run("propagates unexpected error from repo", func(t *testing.T) {
		unexpected := errors.New("db down")
		svc := NewAccessService(
			&mockRepo{
				listUsersForDeviceFn: func(_ context.Context, _ uuid.UUID) ([]domain.UserWithAccessOnDevice, error) {
					return nil, unexpected
				},
			},
			&mockUsersRepo{},
		)

		_, err := svc.ListUsersForDevice(ctx, uuid.Nil, deviceID)
		if !errors.Is(err, unexpected) {
			t.Errorf("expected %v, got %v", unexpected, err)
		}
	})
}
