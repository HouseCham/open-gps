package users

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type mockRepo struct {
	listFn                  func(ctx context.Context, excludeUserID uuid.UUID) ([]domain.User, error)
	getByIDFn               func(ctx context.Context, userID uuid.UUID) (*domain.User, error)
	getByEmailFn            func(ctx context.Context, email string) (*domain.User, error)
	createUserFn            func(ctx context.Context, email, name, lastname string, role domain.UserRole, mustChangePassword, emailVerified bool) (*domain.User, error)
	updateUserFn            func(ctx context.Context, userID uuid.UUID, name, lastname string) (*domain.User, error)
	softDeleteUserFn        func(ctx context.Context, userID uuid.UUID) error
	setMustChangePasswordFn func(ctx context.Context, userID uuid.UUID, mustChange bool) error
	countUsersFn            func(ctx context.Context) (int, error)
	hasSuperAdminFn         func(ctx context.Context) (bool, error)
	promoteToSuperAdminFn   func(ctx context.Context, userID uuid.UUID) (*domain.User, error)
}

func (m *mockRepo) ListUsers(ctx context.Context, excludeUserID uuid.UUID) ([]domain.User, error) {
	return m.listFn(ctx, excludeUserID)
}

func (m *mockRepo) GetByID(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	return m.getByIDFn(ctx, userID)
}

func (m *mockRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	return m.getByEmailFn(ctx, email)
}

func (m *mockRepo) CreateUser(ctx context.Context, email, name, lastname string, role domain.UserRole, mustChangePassword, emailVerified bool) (*domain.User, error) {
	return m.createUserFn(ctx, email, name, lastname, role, mustChangePassword, emailVerified)
}

func (m *mockRepo) UpdateUser(ctx context.Context, userID uuid.UUID, name, lastname string) (*domain.User, error) {
	return m.updateUserFn(ctx, userID, name, lastname)
}

func (m *mockRepo) SetMustChangePassword(ctx context.Context, userID uuid.UUID, mustChange bool) error {
	return m.setMustChangePasswordFn(ctx, userID, mustChange)
}

func (m *mockRepo) SoftDeleteUser(ctx context.Context, userID uuid.UUID) error {
	return m.softDeleteUserFn(ctx, userID)
}

func (m *mockRepo) CountUsers(ctx context.Context) (int, error) {
	return m.countUsersFn(ctx)
}

func (m *mockRepo) HasSuperAdmin(ctx context.Context) (bool, error) {
	if m.hasSuperAdminFn == nil {
		return false, nil
	}
	return m.hasSuperAdminFn(ctx)
}

func (m *mockRepo) PromoteToSuperAdmin(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	if m.promoteToSuperAdminFn == nil {
		return &domain.User{ID: userID, Role: domain.UserRoleSuperAdmin, MustChangePassword: false}, nil
	}
	return m.promoteToSuperAdminFn(ctx, userID)
}

type mockUserCreator struct {
	createFn func(ctx context.Context, name, email, password string) error
}

func (m *mockUserCreator) CreateUserWithPassword(ctx context.Context, name, email, password string) error {
	return m.createFn(ctx, name, email, password)
}

func TestListUsers(t *testing.T) {
	ctx := context.Background()
	ownerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	user1ID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	user2ID := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")

	allUsers := []domain.User{
		{ID: ownerID, Email: "owner@test.com", Role: domain.UserRoleSuperAdmin},
		{ID: user1ID, Email: "user1@test.com", Role: domain.UserRoleUser},
		{ID: user2ID, Email: "user2@test.com", Role: domain.UserRoleUser},
	}

	t.Run("returns all users except excluded ID", func(t *testing.T) {
		svc := NewService(&mockRepo{
			listFn: func(_ context.Context, exclude uuid.UUID) ([]domain.User, error) {
				if exclude != ownerID {
					t.Errorf("expected exclude %v, got %v", ownerID, exclude)
				}
				return []domain.User{allUsers[1], allUsers[2]}, nil
			},
		}, &mockUserCreator{})
		got, err := svc.ListUsers(ctx, ownerID)
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 2 {
			t.Fatalf("expected 2 users, got %d", len(got))
		}
		if got[0].ID != user1ID || got[1].ID != user2ID {
			t.Error("returned wrong users")
		}
	})

	t.Run("returns empty list when only owner exists", func(t *testing.T) {
		svc := NewService(&mockRepo{
			listFn: func(_ context.Context, _ uuid.UUID) ([]domain.User, error) {
				return []domain.User{}, nil
			},
		}, &mockUserCreator{})
		got, err := svc.ListUsers(ctx, ownerID)
		if err != nil {
			t.Fatal(err)
		}
		if len(got) != 0 {
			t.Fatalf("expected 0 users, got %d", len(got))
		}
	})

	t.Run("propagates repository error", func(t *testing.T) {
		expectedErr := errors.New("db closed")
		svc := NewService(&mockRepo{
			listFn: func(_ context.Context, _ uuid.UUID) ([]domain.User, error) {
				return nil, expectedErr
			},
		}, &mockUserCreator{})
		_, err := svc.ListUsers(ctx, ownerID)
		if !errors.Is(err, expectedErr) {
			t.Errorf("expected %v, got %v", expectedErr, err)
		}
	})
}

func TestGetByID(t *testing.T) {
	ctx := context.Background()
	superAdminID := uuid.New()
	ownerID := uuid.New()
	targetID := uuid.New()

	superAdmin := &domain.User{ID: superAdminID, Role: domain.UserRoleSuperAdmin}
	owner := &domain.User{ID: ownerID, Role: domain.UserRoleUser}
	target := &domain.User{ID: targetID, Role: domain.UserRoleUser}

	t.Run("super admin can fetch any user", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				switch id {
				case superAdminID:
					return superAdmin, nil
				case targetID:
					return target, nil
				}
				return nil, domain.ErrNotFound
			},
		}, &mockUserCreator{})
		got, err := svc.GetByID(ctx, superAdminID, targetID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != targetID {
			t.Errorf("got user %v, want %v", got.ID, targetID)
		}
	})

	t.Run("user can fetch themselves", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				return owner, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetByID(ctx, ownerID, ownerID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != ownerID {
			t.Errorf("got user %v, want %v", got.ID, ownerID)
		}
	})

	t.Run("non-admin fetching another user is forbidden", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				switch id {
				case ownerID:
					return owner, nil
				case targetID:
					return target, nil
				}
				return nil, domain.ErrNotFound
			},
		}, &mockUserCreator{})
		_, err := svc.GetByID(ctx, ownerID, targetID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("propagates target lookup error", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				if id == targetID {
					return nil, domain.ErrNotFound
				}
				return owner, nil
			},
		}, &mockUserCreator{})
		_, err := svc.GetByID(ctx, ownerID, targetID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})

	t.Run("propagates requesting user lookup error", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				if id == ownerID {
					return nil, domain.ErrNotFound
				}
				return target, nil
			},
		}, &mockUserCreator{})
		_, err := svc.GetByID(ctx, ownerID, targetID)
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestGetOrCreate(t *testing.T) {
	ctx := context.Background()

	existing := &domain.User{ID: uuid.New(), Email: "exists@test.com", Role: domain.UserRoleUser}

	t.Run("returns existing user without creating", func(t *testing.T) {
		var created bool
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, email string) (*domain.User, error) {
				if email != existing.Email {
					t.Errorf("repo received %q, want %q", email, existing.Email)
				}
				return existing, nil
			},
			// Pretend a super_admin already exists so the existing
			// user is never re-promoted (the user is set up as
			// UserRoleUser and the test expects that role to stick).
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, _ domain.UserRole, _, _ bool) (*domain.User, error) {
				created = true
				return nil, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetOrCreate(ctx, existing.Email, "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != existing.ID {
			t.Errorf("got %v, want %v", got.ID, existing.ID)
		}
		if created {
			t.Error("expected repository CreateUser NOT to be called")
		}
	})

	t.Run("first user is created with super_admin role, must_change_password=false, email_verified=false", func(t *testing.T) {
		var gotRole domain.UserRole
		var gotMustChange, gotEmailVerified bool
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return nil, domain.ErrNotFound
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, nil },
			createUserFn: func(_ context.Context, email, _, _ string, role domain.UserRole, mustChange, emailVerified bool) (*domain.User, error) {
				gotRole = role
				gotMustChange = mustChange
				gotEmailVerified = emailVerified
				return &domain.User{
					ID: uuid.New(), Email: email, Role: role,
					MustChangePassword: mustChange, EmailVerified: emailVerified,
				}, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetOrCreate(ctx, "first@test.com", "First")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotRole != domain.UserRoleSuperAdmin {
			t.Errorf("repo received role %v, want super_admin", gotRole)
		}
		if got.Role != domain.UserRoleSuperAdmin {
			t.Errorf("got role %v, want super_admin", got.Role)
		}
		if gotMustChange {
			t.Error("repo received must_change_password=true, want false for first user (super_admin)")
		}
		if got.MustChangePassword {
			t.Error("got MustChangePassword=true, want false for first user (super_admin)")
		}
		if gotEmailVerified {
			t.Error("repo received email_verified=true, want false")
		}
		if got.EmailVerified {
			t.Error("got EmailVerified=true, want false")
		}
	})

	t.Run("subsequent user is created with user role, must_change_password=true, email_verified=false", func(t *testing.T) {
		var gotRole domain.UserRole
		var gotMustChange, gotEmailVerified bool
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return nil, domain.ErrNotFound
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, role domain.UserRole, mustChange, emailVerified bool) (*domain.User, error) {
				gotRole = role
				gotMustChange = mustChange
				gotEmailVerified = emailVerified
				return &domain.User{Role: role, MustChangePassword: mustChange, EmailVerified: emailVerified}, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetOrCreate(ctx, "fifth@test.com", "Fifth")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotRole != domain.UserRoleUser {
			t.Errorf("repo received role %v, want user", gotRole)
		}
		if got.Role != domain.UserRoleUser {
			t.Errorf("got role %v, want user", got.Role)
		}
		if !gotMustChange {
			t.Error("repo received must_change_password=false, want true for subsequent user")
		}
		if !got.MustChangePassword {
			t.Error("got MustChangePassword=false, want true for subsequent user")
		}
		if gotEmailVerified {
			t.Error("repo received email_verified=true, want false")
		}
		if got.EmailVerified {
			t.Error("got EmailVerified=true, want false")
		}
	})

	t.Run("promotes Authula-created row to super_admin when no super_admin exists", func(t *testing.T) {
		// Simulates the real production path: Authula's email-password
		// signup inserts the user with role='user' (SQL DEFAULT) before
		// our hook fires. GetByEmail returns that row, then
		// GetOrCreate must promote it to super_admin.
		authulaInserted := &domain.User{
			ID:                 uuid.New(),
			Email:              "first@test.com",
			Name:               "First",
			Role:               domain.UserRoleUser,
			MustChangePassword: true,
			EmailVerified:      false,
		}
		var promoted bool
		var promotedID uuid.UUID
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return authulaInserted, nil
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, nil },
			promoteToSuperAdminFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				promoted = true
				promotedID = id
				return &domain.User{
					ID:                 id,
					Email:              authulaInserted.Email,
					Name:               authulaInserted.Name,
					Role:               domain.UserRoleSuperAdmin,
					MustChangePassword: false,
					EmailVerified:      authulaInserted.EmailVerified,
				}, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetOrCreate(ctx, "first@test.com", "First")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !promoted {
			t.Fatal("expected repository PromoteToSuperAdmin to be called")
		}
		if promotedID != authulaInserted.ID {
			t.Errorf("promoted id %v, want %v", promotedID, authulaInserted.ID)
		}
		if got.Role != domain.UserRoleSuperAdmin {
			t.Errorf("got role %v, want super_admin", got.Role)
		}
		if got.MustChangePassword {
			t.Error("got MustChangePassword=true, want false after promotion")
		}
	})

	t.Run("does not promote when a super_admin already exists", func(t *testing.T) {
		existingUser := &domain.User{
			ID:    uuid.New(),
			Email: "second@test.com",
			Role:  domain.UserRoleUser,
		}
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return existingUser, nil
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			promoteToSuperAdminFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				t.Error("PromoteToSuperAdmin must not be called when a super_admin already exists")
				return nil, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetOrCreate(ctx, "second@test.com", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.ID != existingUser.ID {
			t.Errorf("got id %v, want %v", got.ID, existingUser.ID)
		}
		if got.Role != domain.UserRoleUser {
			t.Errorf("got role %v, want user (untouched)", got.Role)
		}
	})

	t.Run("does not promote when existing user is already super_admin", func(t *testing.T) {
		existingAdmin := &domain.User{
			ID:    uuid.New(),
			Email: "admin@test.com",
			Role:  domain.UserRoleSuperAdmin,
		}
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return existingAdmin, nil
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, nil },
			promoteToSuperAdminFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				t.Error("PromoteToSuperAdmin must not be called when the existing row is already super_admin")
				return nil, nil
			},
		}, &mockUserCreator{})
		got, err := svc.GetOrCreate(ctx, "admin@test.com", "")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Role != domain.UserRoleSuperAdmin {
			t.Errorf("got role %v, want super_admin (untouched)", got.Role)
		}
	})

	t.Run("soft-deleted email surfaces as unauthorized", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return nil, domain.ErrNotFound
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, _ domain.UserRole, _, _ bool) (*domain.User, error) {
				return nil, domain.ErrConflict
			},
		}, &mockUserCreator{})
		_, err := svc.GetOrCreate(ctx, "deleted@test.com", "")
		if !errors.Is(err, domain.ErrUnauthorized) {
			t.Errorf("expected ErrUnauthorized, got %v", err)
		}
	})

	t.Run("empty email is unauthorized", func(t *testing.T) {
		svc := NewService(&mockRepo{}, &mockUserCreator{})
		_, err := svc.GetOrCreate(ctx, "", "")
		if !errors.Is(err, domain.ErrUnauthorized) {
			t.Errorf("expected ErrUnauthorized, got %v", err)
		}
	})

	t.Run("propagates HasSuperAdmin error on existing row", func(t *testing.T) {
		expected := errors.New("db closed")
		existingUser := &domain.User{ID: uuid.New(), Email: "a@b.com", Role: domain.UserRoleUser}
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return existingUser, nil
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, expected },
		}, &mockUserCreator{})
		_, err := svc.GetOrCreate(ctx, "a@b.com", "")
		if !errors.Is(err, expected) {
			t.Errorf("expected %v, got %v", expected, err)
		}
	})

	t.Run("propagates HasSuperAdmin error on new row", func(t *testing.T) {
		expected := errors.New("db closed")
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return nil, domain.ErrNotFound
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, expected },
		}, &mockUserCreator{})
		_, err := svc.GetOrCreate(ctx, "a@b.com", "")
		if !errors.Is(err, expected) {
			t.Errorf("expected %v, got %v", expected, err)
		}
	})

	t.Run("propagates promote error on existing row", func(t *testing.T) {
		expected := errors.New("db closed")
		existingUser := &domain.User{ID: uuid.New(), Email: "a@b.com", Role: domain.UserRoleUser}
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return existingUser, nil
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, nil },
			promoteToSuperAdminFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				return nil, expected
			},
		}, &mockUserCreator{})
		_, err := svc.GetOrCreate(ctx, "a@b.com", "")
		if !errors.Is(err, expected) {
			t.Errorf("expected %v, got %v", expected, err)
		}
	})

	t.Run("new user is created with must_change_password=true and email_verified=false", func(t *testing.T) {
		var gotMustChange, gotEmailVerified bool
		var mustChangeCaptured bool
		svc := NewService(&mockRepo{
			getByEmailFn: func(_ context.Context, _ string) (*domain.User, error) {
				return nil, domain.ErrNotFound
			},
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, _ domain.UserRole, mustChange, emailVerified bool) (*domain.User, error) {
				gotMustChange = mustChange
				gotEmailVerified = emailVerified
				mustChangeCaptured = true
				return &domain.User{}, nil
			},
		}, &mockUserCreator{})
		_, err := svc.GetOrCreate(ctx, "self@test.com", "Self")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mustChangeCaptured {
			t.Fatal("repo CreateUser was never called")
		}
		if !gotMustChange {
			t.Error("expected must_change_password=true for non-first self-service signup")
		}
		if gotEmailVerified {
			t.Error("expected email_verified=false for non-first user")
		}
	})
}

func TestCreateUser(t *testing.T) {
	ctx := context.Background()

	t.Run("non-first user is forced to user role, must_change_password=true, email_verified=false", func(t *testing.T) {
		var gotRole domain.UserRole
		var gotMustChange, gotEmailVerified bool
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, role domain.UserRole, mustChange, emailVerified bool) (*domain.User, error) {
				gotRole = role
				gotMustChange = mustChange
				gotEmailVerified = emailVerified
				return &domain.User{
					Email: "a@b.com", Role: role,
					MustChangePassword: mustChange, EmailVerified: emailVerified,
				}, nil
			},
		}, &mockUserCreator{
			createFn: func(_ context.Context, _, _, _ string) error { return nil },
		})
		// Caller asks for super_admin: the service must override to user.
		got, err := svc.CreateUser(ctx, "a@b.com", "A", "B", domain.UserRoleSuperAdmin)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotRole != domain.UserRoleUser {
			t.Errorf("repo received role %v, want user", gotRole)
		}
		if got.User.Role != domain.UserRoleUser {
			t.Errorf("got role %v, want user", got.User.Role)
		}
		if !gotMustChange {
			t.Error("repo received must_change_password=false, want true for non-first user")
		}
		if !got.User.MustChangePassword {
			t.Error("got MustChangePassword=false, want true for non-first user")
		}
		if gotEmailVerified {
			t.Error("repo received email_verified=true, want false")
		}
		if got.User.EmailVerified {
			t.Error("got EmailVerified=true, want false")
		}
	})

	t.Run("first registered user is promoted to super admin with must_change_password=false, email_verified=false", func(t *testing.T) {
		var gotRole domain.UserRole
		var gotMustChange, gotEmailVerified bool
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, nil },
			createUserFn: func(_ context.Context, _, _, _ string, role domain.UserRole, mustChange, emailVerified bool) (*domain.User, error) {
				gotRole = role
				gotMustChange = mustChange
				gotEmailVerified = emailVerified
				return &domain.User{Role: role, MustChangePassword: mustChange, EmailVerified: emailVerified}, nil
			},
		}, &mockUserCreator{
			createFn: func(_ context.Context, _, _, _ string) error { return nil },
		})
		got, err := svc.CreateUser(ctx, "first@system.com", "First", "User", domain.UserRoleUser)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotRole != domain.UserRoleSuperAdmin {
			t.Errorf("repo received role %v, want super_admin", gotRole)
		}
		if got.User.Role != domain.UserRoleSuperAdmin {
			t.Errorf("got role %v, want super_admin", got.User.Role)
		}
		if gotMustChange {
			t.Error("repo received must_change_password=true, want false for first user (super_admin)")
		}
		if got.User.MustChangePassword {
			t.Error("got MustChangePassword=true, want false for first user (super_admin)")
		}
		if gotEmailVerified {
			t.Error("repo received email_verified=true, want false")
		}
		if got.User.EmailVerified {
			t.Error("got EmailVerified=false, want false")
		}
	})

	t.Run("propagates HasSuperAdmin error", func(t *testing.T) {
		expected := errors.New("db closed")
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return false, expected },
		}, &mockUserCreator{})
		_, err := svc.CreateUser(ctx, "a@b.com", "A", "B", domain.UserRoleUser)
		if !errors.Is(err, expected) {
			t.Errorf("expected %v, got %v", expected, err)
		}
	})

	t.Run("propagates auth creator error", func(t *testing.T) {
		expected := errors.New("authula error")
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
		}, &mockUserCreator{
			createFn: func(_ context.Context, _, _, _ string) error { return expected },
		})
		_, err := svc.CreateUser(ctx, "a@b.com", "A", "B", domain.UserRoleUser)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("returns temporary password", func(t *testing.T) {
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, _ domain.UserRole, _, _ bool) (*domain.User, error) {
				return &domain.User{Email: "a@b.com"}, nil
			},
		}, &mockUserCreator{
			createFn: func(_ context.Context, _, _, _ string) error { return nil },
		})
		got, err := svc.CreateUser(ctx, "a@b.com", "A", "B", domain.UserRoleUser)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.TemporaryPassword == "" {
			t.Error("expected non-empty temporary password")
		}
	})

	t.Run("propagates create error", func(t *testing.T) {
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, _ domain.UserRole, _, _ bool) (*domain.User, error) {
				return nil, domain.ErrConflict
			},
		}, &mockUserCreator{
			createFn: func(_ context.Context, _, _, _ string) error { return nil },
		})
		_, err := svc.CreateUser(ctx, "a@b.com", "A", "B", domain.UserRoleUser)
		if !errors.Is(err, domain.ErrConflict) {
			t.Errorf("expected ErrConflict, got %v", err)
		}
	})

	t.Run("new user is created with must_change_password=true", func(t *testing.T) {
		var gotMustChange bool
		svc := NewService(&mockRepo{
			hasSuperAdminFn: func(_ context.Context) (bool, error) { return true, nil },
			createUserFn: func(_ context.Context, _, _, _ string, _ domain.UserRole, mustChange, _ bool) (*domain.User, error) {
				gotMustChange = mustChange
				return &domain.User{}, nil
			},
		}, &mockUserCreator{
			createFn: func(_ context.Context, _, _, _ string) error { return nil },
		})
		_, err := svc.CreateUser(ctx, "a@b.com", "A", "B", domain.UserRoleUser)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !gotMustChange {
			t.Error("expected must_change_password=true for admin-created user")
		}
	})
}

func TestCountUsers(t *testing.T) {
	ctx := context.Background()

	t.Run("returns repository count", func(t *testing.T) {
		svc := NewService(&mockRepo{
			countUsersFn: func(_ context.Context) (int, error) { return 7, nil },
		}, &mockUserCreator{})
		got, err := svc.CountUsers(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != 7 {
			t.Errorf("got %d, want 7", got)
		}
	})

	t.Run("returns zero when no users", func(t *testing.T) {
		svc := NewService(&mockRepo{
			countUsersFn: func(_ context.Context) (int, error) { return 0, nil },
		}, &mockUserCreator{})
		got, err := svc.CountUsers(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got != 0 {
			t.Errorf("got %d, want 0", got)
		}
	})

	t.Run("propagates repository error", func(t *testing.T) {
		expected := errors.New("db closed")
		svc := NewService(&mockRepo{
			countUsersFn: func(_ context.Context) (int, error) { return 0, expected },
		}, &mockUserCreator{})
		_, err := svc.CountUsers(ctx)
		if !errors.Is(err, expected) {
			t.Errorf("expected %v, got %v", expected, err)
		}
	})
}

func TestUpdateUser(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("updates and returns user", func(t *testing.T) {
		svc := NewService(&mockRepo{
			updateUserFn: func(_ context.Context, id uuid.UUID, name, lastname string) (*domain.User, error) {
				if id != userID || name != "New" || lastname != "Name" {
					t.Errorf("repo received %v %q %q, want %v New Name", id, name, lastname, userID)
				}
				return &domain.User{ID: id, Name: name, Lastname: lastname}, nil
			},
		}, &mockUserCreator{})
		got, err := svc.UpdateUser(ctx, userID, "New", "Name")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Name != "New" || got.Lastname != "Name" {
			t.Errorf("got %+v, want Name=New Lastname=Name", got)
		}
	})

	t.Run("propagates repository error", func(t *testing.T) {
		svc := NewService(&mockRepo{
			updateUserFn: func(_ context.Context, _ uuid.UUID, _, _ string) (*domain.User, error) {
				return nil, domain.ErrNotFound
			},
		}, &mockUserCreator{})
		_, err := svc.UpdateUser(ctx, userID, "A", "B")
		if !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func TestSoftDeleteUser(t *testing.T) {
	ctx := context.Background()
	superAdminID := uuid.New()
	ownerID := uuid.New()
	targetID := uuid.New()

	superAdmin := &domain.User{ID: superAdminID, Role: domain.UserRoleSuperAdmin}
	owner := &domain.User{ID: ownerID, Role: domain.UserRoleUser}
	target := &domain.User{ID: targetID, Role: domain.UserRoleUser}

	t.Run("super admin can delete any user", func(t *testing.T) {
		var deleted bool
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				if id == superAdminID {
					return superAdmin, nil
				}
				return target, nil
			},
			softDeleteUserFn: func(_ context.Context, id uuid.UUID) error {
				if id != targetID {
					t.Errorf("repo received %v, want %v", id, targetID)
				}
				deleted = true
				return nil
			},
		}, &mockUserCreator{})
		if err := svc.SoftDeleteUser(ctx, superAdminID, targetID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !deleted {
			t.Error("expected repository SoftDeleteUser to be called")
		}
	})

	t.Run("super admin cannot delete themselves", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				return superAdmin, nil
			},
			softDeleteUserFn: func(_ context.Context, _ uuid.UUID) error {
				t.Error("repository SoftDeleteUser must not be called for super_admin self-delete")
				return nil
			},
		}, &mockUserCreator{})
		err := svc.SoftDeleteUser(ctx, superAdminID, superAdminID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("user can delete themselves", func(t *testing.T) {
		var deleted bool
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				return owner, nil
			},
			softDeleteUserFn: func(_ context.Context, id uuid.UUID) error {
				if id != ownerID {
					t.Errorf("repo received %v, want %v", id, ownerID)
				}
				deleted = true
				return nil
			},
		}, &mockUserCreator{})
		if err := svc.SoftDeleteUser(ctx, ownerID, ownerID); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !deleted {
			t.Error("expected repository SoftDeleteUser to be called")
		}
	})

	t.Run("non-admin deleting another user is forbidden", func(t *testing.T) {
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, id uuid.UUID) (*domain.User, error) {
				if id == ownerID {
					return owner, nil
				}
				return target, nil
			},
			softDeleteUserFn: func(_ context.Context, _ uuid.UUID) error {
				t.Error("repository SoftDeleteUser must not be called on forbidden path")
				return nil
			},
		}, &mockUserCreator{})
		err := svc.SoftDeleteUser(ctx, ownerID, targetID)
		if !errors.Is(err, domain.ErrForbidden) {
			t.Errorf("expected ErrForbidden, got %v", err)
		}
	})

	t.Run("propagates requesting user lookup error", func(t *testing.T) {
		expected := errors.New("db closed")
		svc := NewService(&mockRepo{
			getByIDFn: func(_ context.Context, _ uuid.UUID) (*domain.User, error) {
				return nil, expected
			},
			softDeleteUserFn: func(_ context.Context, _ uuid.UUID) error {
				t.Error("repository SoftDeleteUser must not be called when lookup fails")
				return nil
			},
		}, &mockUserCreator{})
		err := svc.SoftDeleteUser(ctx, ownerID, targetID)
		if !errors.Is(err, expected) {
			t.Errorf("expected %v, got %v", expected, err)
		}
	})
}
