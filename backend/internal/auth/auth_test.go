package auth

import (
	"context"
	"testing"
	"time"

	"github.com/Authula/authula/models"
)

type resetAccountService struct {
	account     *models.Account
	updated     *models.Account
	gotUserID   string
	gotProvider string
}

func (s *resetAccountService) GetByUserIDAndProvider(_ context.Context, userID, provider string) (*models.Account, error) {
	s.gotUserID = userID
	s.gotProvider = provider
	return s.account, nil
}

func (s *resetAccountService) Update(_ context.Context, account *models.Account) (*models.Account, error) {
	s.updated = account
	return account, nil
}

func (s *resetAccountService) Create(context.Context, string, string, string, *string) (*models.Account, error) {
	return nil, nil
}

func (s *resetAccountService) CreateOAuth2(context.Context, string, string, string, string, *string, *time.Time, *time.Time, *string) (*models.Account, error) {
	return nil, nil
}

func (s *resetAccountService) GetByUserID(context.Context, string) (*models.Account, error) {
	return nil, nil
}

func (s *resetAccountService) GetByProviderAndAccountID(context.Context, string, string) (*models.Account, error) {
	return nil, nil
}

func (s *resetAccountService) UpdateFields(context.Context, string, map[string]any) error {
	return nil
}

type resetPasswordService struct{}

func (resetPasswordService) Hash(password string) (string, error) {
	return "hash:" + password, nil
}

func (resetPasswordService) Verify(string, string) bool { return false }

func TestAuthulaPasswordUpdaterResetPasswordUpdatesEmailAccount(t *testing.T) {
	accountService := &resetAccountService{
		account: &models.Account{ID: "account-1", UserID: "user-1", ProviderID: models.AuthProviderEmail.String()},
	}
	updater := authulaPasswordUpdater{
		accountService:  accountService,
		passwordService: resetPasswordService{},
	}

	if err := updater.ResetPassword(context.Background(), "user-1", "new-password"); err != nil {
		t.Fatalf("ResetPassword: unexpected error: %v", err)
	}
	if accountService.gotUserID != "user-1" || accountService.gotProvider != models.AuthProviderEmail.String() {
		t.Fatalf("account lookup = (%q, %q), want (user-1, %q)", accountService.gotUserID, accountService.gotProvider, models.AuthProviderEmail.String())
	}
	if accountService.updated == nil || accountService.updated.Password == nil {
		t.Fatal("ResetPassword did not persist an account password update")
	}
	if got, want := *accountService.updated.Password, "hash:new-password"; got != want {
		t.Fatalf("updated password = %q, want %q", got, want)
	}
}

func TestAuthulaPasswordUpdaterResetPasswordRejectsMissingEmailAccount(t *testing.T) {
	updater := authulaPasswordUpdater{
		accountService:  &resetAccountService{},
		passwordService: resetPasswordService{},
	}

	if err := updater.ResetPassword(context.Background(), "missing-user", "new-password"); err == nil {
		t.Fatal("ResetPassword returned nil for a missing email account")
	}
}
