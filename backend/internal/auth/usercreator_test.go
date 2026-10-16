package auth

import (
	"context"
	"errors"
	"testing"

	"github.com/Authula/authula/models"
	authulaservices "github.com/Authula/authula/services"
)

// The stubs embed the full Authula interfaces so only the methods the
// creator actually touches are implemented; anything else panics and
// catches an accidental new dependency.

type stubUserService struct {
	authulaservices.UserService
	createFn    func(ctx context.Context, name, email string, emailVerified bool, image *string, metadata map[string]any) (*models.User, error)
	getByEmailF func(ctx context.Context, email string) (*models.User, error)
}

func (s *stubUserService) Create(ctx context.Context, name, email string, emailVerified bool, image *string, metadata map[string]any) (*models.User, error) {
	return s.createFn(ctx, name, email, emailVerified, image, metadata)
}

func (s *stubUserService) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	return s.getByEmailF(ctx, email)
}

type stubAccountService struct {
	authulaservices.AccountService
	getFn           func(ctx context.Context, userID, provider string) (*models.Account, error)
	createFn        func(ctx context.Context, userID, accountID, providerID string, password *string) (*models.Account, error)
	updateFieldsFn  func(ctx context.Context, userID string, fields map[string]any) error
	getCalls        int
	createCalls     int
	updateCalls     int
	gotCreateUserID string
	gotCreateFields map[string]any
}

func (s *stubAccountService) GetByUserIDAndProvider(ctx context.Context, userID, provider string) (*models.Account, error) {
	s.getCalls++
	return s.getFn(ctx, userID, provider)
}

func (s *stubAccountService) Create(ctx context.Context, userID, accountID, providerID string, password *string) (*models.Account, error) {
	s.createCalls++
	s.gotCreateUserID = userID
	return s.createFn(ctx, userID, accountID, providerID, password)
}

func (s *stubAccountService) UpdateFields(ctx context.Context, userID string, fields map[string]any) error {
	s.updateCalls++
	s.gotCreateFields = fields
	return s.updateFieldsFn(ctx, userID, fields)
}

type stubPasswordService struct {
	authulaservices.PasswordService
}

func (stubPasswordService) Hash(password string) (string, error) {
	return "hash:" + password, nil
}

func newCreator(users *stubUserService, accounts *stubAccountService) authulaUserCreator {
	return authulaUserCreator{
		userService:     users,
		accountService:  accounts,
		passwordService: stubPasswordService{},
	}
}

func TestCreateUserWithPasswordCreatesMissingAccount(t *testing.T) {
	users := &stubUserService{
		createFn: func(_ context.Context, _, email string, _ bool, _ *string, _ map[string]any) (*models.User, error) {
			return &models.User{ID: "user-1", Email: email}, nil
		},
	}
	accounts := &stubAccountService{
		getFn: func(context.Context, string, string) (*models.Account, error) { return nil, nil },
		createFn: func(_ context.Context, _, _, _ string, password *string) (*models.Account, error) {
			if password == nil || *password != "hash:secret" {
				t.Errorf("account created with password %v, want hash:secret", password)
			}
			return &models.Account{}, nil
		},
	}

	if err := newCreator(users, accounts).CreateUserWithPassword(context.Background(), "A", "a@b.com", "secret"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if accounts.createCalls != 1 {
		t.Errorf("account Create calls: got %d, want 1", accounts.createCalls)
	}
	if accounts.updateCalls != 0 {
		t.Errorf("account UpdateFields calls: got %d, want 0", accounts.updateCalls)
	}
}

// BA-09 boundary A: the user exists (a prior attempt crashed before
// the account landed). The retry must create the missing account
// instead of dying on "email already in use" forever.
func TestCreateUserWithPasswordRepairsUserWithoutAccount(t *testing.T) {
	users := &stubUserService{
		createFn: func(context.Context, string, string, bool, *string, map[string]any) (*models.User, error) {
			return nil, errors.New("email already in use")
		},
		getByEmailF: func(_ context.Context, email string) (*models.User, error) {
			return &models.User{ID: "user-1", Email: email}, nil
		},
	}
	accounts := &stubAccountService{
		getFn: func(context.Context, string, string) (*models.Account, error) { return nil, nil },
		createFn: func(_ context.Context, _, _, _ string, _ *string) (*models.Account, error) {
			return &models.Account{}, nil
		},
	}

	if err := newCreator(users, accounts).CreateUserWithPassword(context.Background(), "A", "a@b.com", "secret"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if accounts.createCalls != 1 {
		t.Errorf("account Create calls: got %d, want 1 (missing account repaired)", accounts.createCalls)
	}
}

func TestCreateUserWithPasswordRotatesPasswordOnExistingAccount(t *testing.T) {
	users := &stubUserService{
		createFn: func(context.Context, string, string, bool, *string, map[string]any) (*models.User, error) {
			return nil, errors.New("email already in use")
		},
		getByEmailF: func(_ context.Context, email string) (*models.User, error) {
			return &models.User{ID: "user-1", Email: email}, nil
		},
	}
	accounts := &stubAccountService{
		getFn: func(context.Context, string, string) (*models.Account, error) {
			old := "hash:old-password"
			return &models.Account{UserID: "user-1", Password: &old}, nil
		},
		createFn: func(context.Context, string, string, string, *string) (*models.Account, error) {
			t.Error("account Create must not run when the account already exists")
			return nil, nil
		},
		updateFieldsFn: func(_ context.Context, _ string, _ map[string]any) error { return nil },
	}

	if err := newCreator(users, accounts).CreateUserWithPassword(context.Background(), "A", "a@b.com", "new-temp"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if accounts.updateCalls != 1 {
		t.Fatalf("account UpdateFields calls: got %d, want 1 (temp password must land)", accounts.updateCalls)
	}
	if got := accounts.gotCreateFields["password"]; got != "hash:new-temp" {
		t.Errorf("password field: got %v, want hash:new-temp", got)
	}
}

func TestCreateUserWithPasswordSkipsRotationWhenHashUnchanged(t *testing.T) {
	users := &stubUserService{
		createFn: func(context.Context, string, string, bool, *string, map[string]any) (*models.User, error) {
			return nil, errors.New("email already in use")
		},
		getByEmailF: func(_ context.Context, email string) (*models.User, error) {
			return &models.User{ID: "user-1", Email: email}, nil
		},
	}
	same := "hash:secret"
	accounts := &stubAccountService{
		getFn: func(context.Context, string, string) (*models.Account, error) {
			return &models.Account{UserID: "user-1", Password: &same}, nil
		},
		createFn:       func(context.Context, string, string, string, *string) (*models.Account, error) { return nil, nil },
		updateFieldsFn: func(context.Context, string, map[string]any) error { return nil },
	}

	if err := newCreator(users, accounts).CreateUserWithPassword(context.Background(), "A", "a@b.com", "secret"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if accounts.updateCalls != 0 || accounts.createCalls != 0 {
		t.Errorf("writes on identical hash: create=%d update=%d, want both 0", accounts.createCalls, accounts.updateCalls)
	}
}

func TestCreateUserWithPasswordFailsFastOnUnrelatedCreateError(t *testing.T) {
	expected := errors.New("connection refused")
	users := &stubUserService{
		createFn: func(context.Context, string, string, bool, *string, map[string]any) (*models.User, error) {
			return nil, expected
		},
		getByEmailF: func(context.Context, string) (*models.User, error) {
			t.Error("GetByEmail must not run for errors that are not email-conflict")
			return nil, nil
		},
	}
	accounts := &stubAccountService{}

	err := newCreator(users, accounts).CreateUserWithPassword(context.Background(), "A", "a@b.com", "secret")
	if !errors.Is(err, expected) {
		t.Fatalf("expected %v, got %v", expected, err)
	}
	if accounts.getCalls != 0 || accounts.createCalls != 0 {
		t.Errorf("account calls after fail-fast: get=%d create=%d, want 0", accounts.getCalls, accounts.createCalls)
	}
}

func TestCreateUserWithPasswordUsesProviderEmailAccountID(t *testing.T) {
	users := &stubUserService{
		createFn: func(_ context.Context, _, email string, _ bool, _ *string, _ map[string]any) (*models.User, error) {
			return &models.User{ID: "user-1", Email: email}, nil
		},
	}
	accounts := &stubAccountService{
		getFn: func(context.Context, string, string) (*models.Account, error) { return nil, nil },
		createFn: func(_ context.Context, userID, accountID, providerID string, _ *string) (*models.Account, error) {
			if userID != "user-1" || accountID != "a@b.com" || providerID != "email" {
				t.Errorf("Create(%q, %q, %q), want (user-1, a@b.com, email)", userID, accountID, providerID)
			}
			return &models.Account{}, nil
		},
	}

	if err := newCreator(users, accounts).CreateUserWithPassword(context.Background(), "A", "a@b.com", "secret"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
