package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Authula/authula/models"
	authulaservices "github.com/Authula/authula/services"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/users"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

type signupHookUserLookup struct {
	authulaservices.UserService
	user       *models.User
	getErr     error
	deleteErr  error
	deleteCall int
}

func (s *signupHookUserLookup) GetByID(context.Context, string) (*models.User, error) {
	return s.user, s.getErr
}

func (s *signupHookUserLookup) Delete(context.Context, string) error {
	s.deleteCall++
	return s.deleteErr
}

type signupHookUsersRepo struct {
	users.Repository
	user          *domain.User
	getByEmailErr error
	deleted       int
}

func (r *signupHookUsersRepo) GetByEmail(context.Context, string) (*domain.User, error) {
	if r.getByEmailErr != nil {
		return nil, r.getByEmailErr
	}
	return r.user, nil
}

func (r *signupHookUsersRepo) PromoteIfFirstUser(context.Context, uuid.UUID) (*domain.User, error) {
	return r.user, nil
}

func (r *signupHookUsersRepo) SoftDeleteUser(context.Context, uuid.UUID) error {
	r.deleted++
	return nil
}

func newSignupHookContext(actorID string) *models.RequestContext {
	return &models.RequestContext{
		Request: httptest.NewRequest(http.MethodPost, BasePath+"/email-password/sign-up", nil),
		Method:  http.MethodPost,
		Path:    BasePath + "/email-password/sign-up",
		Actor:   &models.Actor{ID: actorID, Type: models.ActorUser},
	}
}

func TestSignupMirrorHookFailsClosedWhenAuthulaUserLookupFails(t *testing.T) {
	lookup := &signupHookUserLookup{
		getErr:    errors.New("authula lookup unavailable"),
		deleteErr: errors.New("authula delete unavailable"),
	}
	repo := &signupHookUsersRepo{}
	usersSvc := users.NewService(repo, nil)
	hook := SignupMirrorHook(&Auth{userService: lookup}, usersSvc)
	rc := newSignupHookContext("new-user")

	if !hook.Matcher(rc) {
		t.Fatal("signup hook did not match email-password signup")
	}
	if err := hook.Handler(rc); !errors.Is(err, lookup.deleteErr) {
		t.Fatalf("hook error=%v, want wrapped delete error %v", err, lookup.deleteErr)
	}
	if !rc.Handled || rc.ResponseStatus != http.StatusServiceUnavailable {
		t.Fatalf("response handled=%v status=%d, want handled 503 after failed revocation", rc.Handled, rc.ResponseStatus)
	}
	if lookup.deleteCall != 1 {
		t.Errorf("Authula delete calls=%d, want 1", lookup.deleteCall)
	}
	if repo.deleted != 0 {
		t.Errorf("local deletes=%d, want 0 when user lookup did not identify a projection", repo.deleted)
	}
}

func TestSignupMirrorHookFailsClosedWhenLocalMirrorFails(t *testing.T) {
	lookup := &signupHookUserLookup{user: &models.User{ID: "new-user", Email: "new@example.com"}}
	repo := &signupHookUsersRepo{getByEmailErr: errors.New("database unavailable")}
	usersSvc := users.NewService(repo, nil)
	hook := SignupMirrorHook(&Auth{userService: lookup}, usersSvc)
	rc := newSignupHookContext("new-user")

	if err := hook.Handler(rc); err != nil {
		t.Fatalf("hook returned unexpected error: %v", err)
	}
	if !rc.Handled || rc.ResponseStatus != http.StatusForbidden {
		t.Fatalf("response handled=%v status=%d, want handled 403", rc.Handled, rc.ResponseStatus)
	}
	if lookup.deleteCall != 1 {
		t.Errorf("Authula delete calls=%d, want 1", lookup.deleteCall)
	}
}

func TestSignupMirrorHookRejectsNonBootstrapSignup(t *testing.T) {
	lookup := &signupHookUserLookup{user: &models.User{ID: "new-user", Email: "new@example.com", Name: "New"}}
	repo := &signupHookUsersRepo{user: &domain.User{ID: uuid.New(), Role: domain.UserRoleUser}}
	usersSvc := users.NewService(repo, nil)
	hook := SignupMirrorHook(&Auth{userService: lookup}, usersSvc)
	rc := newSignupHookContext("new-user")

	if err := hook.Handler(rc); err != nil {
		t.Fatalf("hook returned unexpected error: %v", err)
	}
	if !rc.Handled || rc.ResponseStatus != http.StatusForbidden {
		t.Fatalf("response handled=%v status=%d, want handled 403", rc.Handled, rc.ResponseStatus)
	}
	if lookup.deleteCall != 1 || repo.deleted != 1 {
		t.Errorf("revocation calls: Authula=%d local=%d, want 1/1", lookup.deleteCall, repo.deleted)
	}
}

func TestSignupMirrorHookAllowsBootstrapAdmin(t *testing.T) {
	lookup := &signupHookUserLookup{user: &models.User{ID: "first-user", Email: "first@example.com"}}
	repo := &signupHookUsersRepo{user: &domain.User{ID: uuid.New(), Role: domain.UserRoleSuperAdmin}}
	usersSvc := users.NewService(repo, nil)
	hook := SignupMirrorHook(&Auth{userService: lookup}, usersSvc)
	rc := newSignupHookContext("first-user")

	if err := hook.Handler(rc); err != nil {
		t.Fatalf("hook returned unexpected error: %v", err)
	}
	if rc.Handled {
		t.Fatal("bootstrap super_admin signup was unexpectedly rejected")
	}
	if lookup.deleteCall != 0 || repo.deleted != 0 {
		t.Errorf("bootstrap signup was revoked: Authula=%d local=%d", lookup.deleteCall, repo.deleted)
	}
}
