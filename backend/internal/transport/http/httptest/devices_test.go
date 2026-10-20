package httptest

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/devices"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
)

func TestDevicesList(t *testing.T) {
	t.Run("200 - returns devices for authenticated user", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Living Room GPS",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)

		resp, err := ta.Request("GET", "/api/v1/devices", "token-owner", nil)
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
		if httpResp.Message != "devices retrieved" {
			t.Errorf("expected message 'devices retrieved', got %q", httpResp.Message)
		}
	})

	t.Run("200 - returns empty list when user has no devices", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-2", "user@test.com", "User", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/devices", "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		resp, err := ta.Request("GET", "/api/v1/devices", "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - invalid token", func(t *testing.T) {
		ta := NewTestApp()

		resp, err := ta.Request("GET", "/api/v1/devices", "invalid-token", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestDevicesGet(t *testing.T) {
	t.Run("200 - returns device when user has access", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Living Room GPS",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)

		resp, err := ta.Request("GET", "/api/v1/devices/"+device.ID.String(), "token-owner", nil)
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
		if httpResp.Message != "device retrieved" {
			t.Errorf("expected message 'device retrieved', got %q", httpResp.Message)
		}
	})

	t.Run("404 - device not found or no access", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-2", "user@test.com", "User", domain.UserRoleUser)

		nonExistentID := uuid.New()
		resp, err := ta.Request("GET", "/api/v1/devices/"+nonExistentID.String(), "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - invalid device id format", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-2", "user@test.com", "User", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/devices/invalid-uuid", "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		deviceID := uuid.New()
		resp, err := ta.Request("GET", "/api/v1/devices/"+deviceID.String(), "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestDevicesCreate(t *testing.T) {
	t.Run("201 - creates device successfully", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"uuid_firmware": uuid.New().String(),
			"name":          "New Device",
			"vehicle_type":  "car",
		}

		resp, err := ta.Request("POST", "/api/v1/devices", "token-user", body)
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
		if httpResp.Message != "device created" {
			t.Errorf("expected message 'device created', got %q", httpResp.Message)
		}
	})

	t.Run("403 - device limit reached when user already owns the cap", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		// Fill the per-user cap through the real create path, then the
		// next create must be rejected with 403.
		for i := 0; i < devices.MaxDevicesPerUser; i++ {
			okBody := map[string]string{
				"uuid_firmware": uuid.New().String(),
				"name":          "Filler",
				"vehicle_type":  "car",
			}
			resp, err := ta.Request("POST", "/api/v1/devices", "token-user", okBody)
			if err != nil {
				t.Fatalf("filler request error: %v", err)
			}
			if resp.StatusCode != http.StatusCreated {
				t.Fatalf("filler create: expected 201, got %d", resp.StatusCode)
			}
		}

		body := map[string]string{
			"uuid_firmware": uuid.New().String(),
			"name":          "One Too Many",
			"vehicle_type":  "car",
		}

		resp, err := ta.Request("POST", "/api/v1/devices", "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}

		httpResp, err := ParseResponse(resp)
		if err != nil {
			t.Fatalf("parse error: %v", err)
		}
		want := "device limit reached (max 10 devices per user)"
		if httpResp.Message != want {
			t.Errorf("expected message %q, got %q", want, httpResp.Message)
		}
	})

	t.Run("400 - invalid uuid_firmware format", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"uuid_firmware": "not-a-uuid",
			"name":          "New Device",
			"vehicle_type":  "car",
		}

		resp, err := ta.Request("POST", "/api/v1/devices", "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - missing required fields", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"uuid_firmware": uuid.New().String(),
		}

		resp, err := ta.Request("POST", "/api/v1/devices", "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("400 - invalid vehicle_type", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"uuid_firmware": uuid.New().String(),
			"name":          "New Device",
			"vehicle_type":  "spaceship",
		}

		resp, err := ta.Request("POST", "/api/v1/devices", "token-user", body)
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
			"uuid_firmware": uuid.New().String(),
			"name":          "New Device",
			"vehicle_type":  "car",
		}

		resp, err := ta.Request("POST", "/api/v1/devices", "", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestDevicesUpdate(t *testing.T) {
	t.Run("200 - updates device name", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Original Name",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)

		body := map[string]string{
			"name": "Updated Name",
		}

		resp, err := ta.Request("PUT", "/api/v1/devices/"+device.ID.String(), "token-owner", body)
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
		if httpResp.Message != "device updated" {
			t.Errorf("expected message 'device updated', got %q", httpResp.Message)
		}
	})

	t.Run("200 - updates name and vehicle_type together", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Original Name",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)

		body := map[string]string{
			"name":         "Updated Name",
			"vehicle_type": "van",
		}

		resp, err := ta.Request("PUT", "/api/v1/devices/"+device.ID.String(), "token-owner", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}
		if device.Name != "Updated Name" {
			t.Errorf("device name not updated in store: got %q", device.Name)
		}
		if device.VehicleType != "van" {
			t.Errorf("device vehicle_type not updated in store: got %q", device.VehicleType)
		}
	})

	t.Run("400 - invalid vehicle_type on update", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Original Name",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)

		body := map[string]string{
			"name":         "Updated Name",
			"vehicle_type": "spaceship",
		}

		resp, err := ta.Request("PUT", "/api/v1/devices/"+device.ID.String(), "token-owner", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("expected status 400, got %d", resp.StatusCode)
		}
	})

	t.Run("403 - user has only viewer access", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)
		viewerID := ta.SetupUser("token-viewer", "authula-2", "viewer@test.com", "Viewer", domain.UserRoleUser)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Original Name",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)
		ta.AddDevice(viewerID, device, domain.AccessRoleViewer)

		body := map[string]string{
			"name": "Updated Name",
		}

		resp, err := ta.Request("PUT", "/api/v1/devices/"+device.ID.String(), "token-viewer", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("404 - device not found", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		body := map[string]string{
			"name": "Updated Name",
		}

		nonExistentID := uuid.New()
		resp, err := ta.Request("PUT", "/api/v1/devices/"+nonExistentID.String(), "token-user", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		body := map[string]string{
			"name": "Updated Name",
		}

		deviceID := uuid.New()
		resp, err := ta.Request("PUT", "/api/v1/devices/"+deviceID.String(), "", body)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestDevicesDelete(t *testing.T) {
	t.Run("204 - deletes device successfully", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Device to Delete",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)

		resp, err := ta.Request("DELETE", "/api/v1/devices/"+device.ID.String(), "token-owner", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", resp.StatusCode)
		}
	})

	t.Run("403 - user has only editor access", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)
		editorID := ta.SetupUser("token-editor", "authula-2", "editor@test.com", "Editor", domain.UserRoleUser)

		device := &domain.Device{
			ID:           uuid.New(),
			UuidFirmware: "esp32-001",
			Name:         "Device",
			CreatedAt:    time.Now(),
		}
		ta.AddDevice(ownerID, device, domain.AccessRoleOwner)
		ta.AddDevice(editorID, device, domain.AccessRoleEditor)

		resp, err := ta.Request("DELETE", "/api/v1/devices/"+device.ID.String(), "token-editor", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusForbidden {
			t.Errorf("expected status 403, got %d", resp.StatusCode)
		}
	})

	t.Run("404 - device not found", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-1", "user@test.com", "User", domain.UserRoleUser)

		nonExistentID := uuid.New()
		resp, err := ta.Request("DELETE", "/api/v1/devices/"+nonExistentID.String(), "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		deviceID := uuid.New()
		resp, err := ta.Request("DELETE", "/api/v1/devices/"+deviceID.String(), "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}

func TestDevicesCount(t *testing.T) {
	t.Run("200 - returns total count of accessible devices", func(t *testing.T) {
		ta := NewTestApp()

		ownerID := ta.SetupUser("token-owner", "authula-1", "owner@test.com", "Owner", domain.UserRoleSuperAdmin)

		for i := 0; i < 3; i++ {
			d := &domain.Device{
				ID:           uuid.New(),
				UuidFirmware: "esp32-" + string(rune('a'+i)),
				Name:         "Tracker",
				CreatedAt:    time.Now(),
			}
			ta.AddDevice(ownerID, d, domain.AccessRoleOwner)
		}

		resp, err := ta.Request("GET", "/api/v1/devices/count", "token-owner", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got %d", resp.StatusCode)
		}

		data, err := ParseResponseData[dto.DeviceCountResponse](resp)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if data == nil {
			t.Fatalf("expected non-nil data")
		}
		if data.Total != 3 {
			t.Errorf("total: want 3, got %d", data.Total)
		}
	})

	t.Run("200 - zero when user has no devices", func(t *testing.T) {
		ta := NewTestApp()

		ta.SetupUser("token-user", "authula-2", "user@test.com", "User", domain.UserRoleUser)

		resp, err := ta.Request("GET", "/api/v1/devices/count", "token-user", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected status 200, got %d", resp.StatusCode)
		}

		data, err := ParseResponseData[dto.DeviceCountResponse](resp)
		if err != nil {
			t.Fatalf("parse: %v", err)
		}
		if data == nil {
			t.Fatalf("expected non-nil data")
		}
		if data.Total != 0 {
			t.Errorf("total: want 0, got %d", data.Total)
		}
	})

	t.Run("401 - no authorization header", func(t *testing.T) {
		ta := NewTestApp()

		resp, err := ta.Request("GET", "/api/v1/devices/count", "", nil)
		if err != nil {
			t.Fatalf("request error: %v", err)
		}

		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401, got %d", resp.StatusCode)
		}
	})
}
