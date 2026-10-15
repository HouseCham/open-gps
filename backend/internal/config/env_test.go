package config_test

import (
	"strings"
	"testing"

	"github.com/HouseCham/gps-tracker/backend/internal/config"
)

func TestLoadPublicOrigin(t *testing.T) {
	cases := []struct {
		name    string
		value   string
		want    string // empty means an error is expected
		wantErr string
	}{
		{name: "https origin", value: "https://app.example.com", want: "https://app.example.com"},
		{name: "http origin for local dev", value: "http://localhost", want: "http://localhost"},
		{name: "trailing slash is stripped", value: "https://localhost/", want: "https://localhost"},
		{name: "port is allowed", value: "https://app.example.com:8443", want: "https://app.example.com:8443"},
		// Userinfo lets https://trusted.example@attacker.example pass a
		// naive host check while browsers navigate to attacker.example.
		{name: "userinfo is rejected", value: "https://trusted.example@attacker.example", wantErr: "userinfo"},
		{name: "userinfo on localhost is rejected", value: "http://user@localhost", wantErr: "userinfo"},
		{name: "path is rejected", value: "https://app.example.com/reset", wantErr: "path"},
		{name: "query is rejected", value: "https://app.example.com?a=b", wantErr: "query"},
		{name: "fragment is rejected", value: "https://app.example.com#x", wantErr: "query"},
		{name: "missing scheme is rejected", value: "app.example.com", wantErr: "http or https"},
		{name: "unsupported scheme is rejected", value: "ftp://app.example.com", wantErr: "http or https"},
		{name: "missing host is rejected", value: "https://", wantErr: "host"},
		{name: "empty is rejected", value: "", wantErr: "required"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("PUBLIC_APP_ORIGIN", tc.value)
			got, err := config.LoadPublicOrigin()
			if tc.wantErr != "" {
				if err == nil {
					t.Fatalf("LoadPublicOrigin() = %q, want error containing %q", got, tc.wantErr)
				}
				if !strings.Contains(err.Error(), tc.wantErr) {
					t.Errorf("err = %v, want it to contain %q", err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("LoadPublicOrigin(): unexpected err: %v", err)
			}
			if got != tc.want {
				t.Errorf("LoadPublicOrigin() = %q, want %q", got, tc.want)
			}
		})
	}
}
