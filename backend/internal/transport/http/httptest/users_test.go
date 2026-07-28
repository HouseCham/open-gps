package httptest

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
)

func TestUsersList(t *testing.T) {
	t.Run("200 - super_admin can list users", func(t *testing.T) {
		ta := NewTestApp()

		adminID := ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)
		userID := ta.SetupUser("token-user", "authula-2", "user@test.com", "User", domain.UserRoleUser)

		_ = adminID
		_ = userID

		resp, err := ta.Request("GET", "/api/v1/users", "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		httpResp, err := ParseResponse(resp)
		if err != nil {
			t.Fatalf("parse error: %v", err)
		}
		if httpResp.Message != "users retrieved" {
			t.Errorf("expected message 'users retrieved', got %q", httpResp.Message)
		}
	})

	t.Run("403 - regular user cannot list users", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/users", "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		resp, err := ta.Request("GET", "/api/v1/users", "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestUsersGetByID(t *testing.T) {
	t.Run("200 - super_admin can get any user", func(t *testing.T) {
		ta := NewTestApp()

		_ = ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)
		targetID := ta.SetupUser("token-user", "authula-2", "user@test.com", "User", domain.UserRoleUser)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Test Device",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(targetID, device, domain.AccessRoleOwner)

		resp, err := ta.Request("GET", "/api/v1/users/"+targetID.String(), "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		httpResp, err := ParseResponse(resp)
		if err != nil {
			t.Fatalf("parse error: %v", err)
		}
		if httpResp.Message != "user retrieved" {
			t.Errorf("expected message 'user retrieved', got %q", httpResp.Message)
		}
	})

	t.Run("200 - user can get themselves", func(t *testing.T) {
		ta := NewTestApp()

		userID := ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/users/"+userID.String(), "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}
	})

	t.Run("403 - user cannot get another user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)
		targetID := ta.SetupUser("token-target", "authula-2", "target@test.com", "Target", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/users/"+targetID.String(), "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("404 - user not found", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		nonExistentID := uuid.New()
		resp, err := ta.Request("GET", "/api/v1/users/"+nonExistentID.String(), "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - invalid user id format", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		resp, err := ta.Request("GET", "/api/v1/users/invalid-uuid", "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		userID := uuid.New()
		resp, err := ta.Request("GET", "/api/v1/users/"+userID.String(), "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestUsersCreate(t *testing.T) {
	t.Run("201 - super_admin creates user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		body := map[string]string{
			"email":    "newuser@test.com",
			"name":     "New",
			"lastname": "User",
			"role":     "user",
		}

		resp, err := ta.Request("POST", "/api/v1/users", "token-admin", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusCreated {
			t.Errorf("expected status 201, got %d", resp.StatusCode)
		}

		httpResp, err := ParseResponse(resp)
		if err != nil {
			t.Fatalf("parse error: %v", err)
		}
		if httpResp.Message != "user created" {
			t.Errorf("expected message 'user created', got %q", httpResp.Message)
		}
	})

	t.Run("403 - regular user cannot create user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"email":    "newuser@test.com",
			"name":     "New",
			"lastname": "User",
			"role":     "user",
		}

		resp, err := ta.Request("POST", "/api/v1/users", "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - invalid email format", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		body := map[string]string{
			"email":    "not-an-email",
			"name":     "New",
			"lastname": "User",
			"role":     "user",
		}

		resp, err := ta.Request("POST", "/api/v1/users", "token-admin", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - missing required fields", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		body := map[string]string{
			"email": "newuser@test.com",
		}

		resp, err := ta.Request("POST", "/api/v1/users", "token-admin", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		body := map[string]string{
			"email":    "newuser@test.com",
			"name":     "New",
			"lastname": "User",
			"role":     "user",
		}

		resp, err := ta.Request("POST", "/api/v1/users", "", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestUsersUpdate(t *testing.T) {
	t.Run("200 - user updates their own profile", func(t *testing.T) {
		ta := NewTestApp()

		userID := ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"name":     "Updated",
			"lastname": "Name",
		}

		resp, err := ta.Request("PUT", "/api/v1/users/"+userID.String(), "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		httpResp, err := ParseResponse(resp)
		if err != nil {
			t.Fatalf("parse error: %v", err)
		}
		if httpResp.Message != "user updated" {
			t.Errorf("expected message 'user updated', got %q", httpResp.Message)
		}
	})

	t.Run("403 - user cannot update another user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)
		targetID := ta.SetupUser("token-target", "authula-2", "target@test.com", "Target", domain.UserRoleUser)

		body := map[string]string{
			"name": "Hacked",
		}

		resp, err := ta.Request("PUT", "/api/v1/users/"+targetID.String(), "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("403 - user cannot update another user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)
		targetID := ta.SetupUser("token-target", "authula-2", "target@test.com", "Target", domain.UserRoleUser)

		body := map[string]string{
			"name": "Hacked",
		}

		resp, err := ta.Request("PUT", "/api/v1/users/"+targetID.String(), "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("403 - super_admin cannot update another user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)
		targetID := ta.SetupUser("token-target", "authula-2", "target@test.com", "Target", domain.UserRoleUser)

		body := map[string]string{
			"name": "Updated",
		}

		resp, err := ta.Request("PUT", "/api/v1/users/"+targetID.String(), "token-admin", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - invalid user id format", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"name": "Updated",
		}

		resp, err := ta.Request("PUT", "/api/v1/users/invalid-uuid", "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		body := map[string]string{
			"name": "Updated",
		}

		userID := uuid.New()
		resp, err := ta.Request("PUT", "/api/v1/users/"+userID.String(), "", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestUsersDelete(t *testing.T) {
	t.Run("204 - super_admin deletes user", func(t *testing.T) {
		ta := NewTestApp()

		adminID := ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)
		targetID := ta.SetupUser("token-target", "authula-2", "target@test.com", "Target", domain.UserRoleUser)

		_ = adminID
		_ = targetID

		resp, err := ta.Request("DELETE", "/api/v1/users/"+targetID.String(), "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", resp.StatusCode)
		}
	})

	t.Run("204 - user deletes themselves", func(t *testing.T) {
		ta := NewTestApp()

		userID := ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		resp, err := ta.Request("DELETE", "/api/v1/users/"+userID.String(), "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", resp.StatusCode)
		}
	})

	t.Run("403 - user cannot delete another user", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)
		targetID := ta.SetupUser("token-target", "authula-2", "target@test.com", "Target", domain.UserRoleUser)

		resp, err := ta.Request("DELETE", "/api/v1/users/"+targetID.String(), "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("404 - user not found", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		nonExistentID := uuid.New()
		resp, err := ta.Request("DELETE", "/api/v1/users/"+nonExistentID.String(), "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - invalid user id format", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-admin", "authula-1", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		resp, err := ta.Request("DELETE", "/api/v1/users/invalid-uuid", "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		userID := uuid.New()
		resp, err := ta.Request("DELETE", "/api/v1/users/"+userID.String(), "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestUsersMe(t *testing.T) {
	t.Run("200 - returns Authula user projection", func(t *testing.T) {
		ta := NewTestApp()

		_ = ta.SetupUser("token-me", "authula-me", "me@test.com", "Me", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/auth/me", "token-me", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got %d", resp.StatusCode)
		}

		body, err := ParseResponseBody(resp)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}

		var got struct {
			User struct {
				ID    string `json:"id"`
				Email string `json:"email"`
				Name  string `json:"name"`
			} `json:"user"`
		}
		if err := json.Unmarshal(body, &got); err != nil {
			t.Fatalf("unmarshal: %v\nbody: %s", err, body)
		}

		if got.User.ID != "authula-me" {
			t.Errorf("user.id: want %q, got %q", "authula-me", got.User.ID)
		}
		if got.User.Email != "me@test.com" {
			t.Errorf("user.email: want %q, got %q", "me@test.com", got.User.Email)
		}
		if got.User.Name != "Me" {
			t.Errorf("user.name: want %q, got %q", "Me", got.User.Name)
		}
	})

	t.Run("401 - no session cookie", func(t *testing.T) {
		ta := NewTestApp()

		resp, err := ta.Request("GET", "/api/auth/me", "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestUsersGetMe(t *testing.T) {
	t.Run("200 - returns full local projection", func(t *testing.T) {
		ta := NewTestApp()

		_ = ta.SetupUser("token-me", "authula-me", "me@test.com", "Me", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/users/me", "token-me", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got %d", resp.StatusCode)
		}

		data, err := ParseResponseData[dto.UserResponse](resp)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if data == nil {
			t.Fatalf("expected non-nil data")
		}

		if data.Email != "me@test.com" {
			t.Errorf("email: want %q, got %q", "me@test.com", data.Email)
		}
		if data.Name != "Me" {
			t.Errorf("name: want %q, got %q", "Me", data.Name)
		}
		if data.Role != "user" {
			t.Errorf("role: want %q, got %q", "user", data.Role)
		}
		if data.CreatedAt.IsZero() {
			t.Errorf("created_at must be present")
		}
	})

	t.Run("200 - super_admin sees their own role", func(t *testing.T) {
		ta := NewTestApp()

		_ = ta.SetupUser("token-admin", "authula-admin", "admin@test.com", "Admin", domain.UserRoleSuperAdmin)

		resp, err := ta.Request("GET", "/api/v1/users/me", "token-admin", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got %d", resp.StatusCode)
		}

		data, err := ParseResponseData[dto.UserResponse](resp)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if data == nil {
			t.Fatalf("expected non-nil data")
		}
		if data.Role != "super_admin" {
			t.Errorf("role: want %q, got %q", "super_admin", data.Role)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		resp, err := ta.Request("GET", "/api/v1/users/me", "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}
