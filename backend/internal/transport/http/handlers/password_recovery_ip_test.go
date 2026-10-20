package handlers

import (
	"io"
	"net"
	"net/http"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestPasswordRecoveryClientIP(t *testing.T) {
	tests := []struct {
		name       string
		proxy      fiber.TrustProxyConfig
		header     string
		want       string
		wantStatus int
	}{
		{
			name:       "trusted proxy supplies canonical client IP",
			proxy:      fiber.TrustProxyConfig{Loopback: true},
			header:     "203.0.113.42",
			want:       "203.0.113.42",
			wantStatus: http.StatusOK,
		},
		{
			name:       "untrusted peer cannot spoof X-Real-IP",
			proxy:      fiber.TrustProxyConfig{Proxies: []string{"10.0.0.10"}},
			header:     "203.0.113.42",
			want:       "127.0.0.1",
			wantStatus: http.StatusOK,
		},
		{
			name:       "trusted proxy without client IP fails closed",
			proxy:      fiber.TrustProxyConfig{Loopback: true},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New(fiber.Config{
				TrustProxy:         true,
				ProxyHeader:        "X-Real-IP",
				EnableIPValidation: true,
				TrustProxyConfig:   tt.proxy,
			})
			app.Get("/client-ip", func(c fiber.Ctx) error {
				ip, err := passwordRecoveryClientIP(c)
				if err != nil {
					return c.SendStatus(fiber.StatusBadRequest)
				}
				return c.SendString(ip)
			})

			listener, err := net.Listen("tcp4", "127.0.0.1:0")
			if err != nil {
				t.Fatalf("listen: %v", err)
			}
			serveDone := make(chan struct{})
			go func() {
				defer close(serveDone)
				_ = app.Listener(listener)
			}()
			t.Cleanup(func() {
				_ = app.Shutdown()
				<-serveDone
			})

			req, err := http.NewRequest(http.MethodGet, "http://"+listener.Addr().String()+"/client-ip", nil)
			if err != nil {
				t.Fatalf("new request: %v", err)
			}
			if tt.header != "" {
				req.Header.Set("X-Real-IP", tt.header)
			}
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatalf("request: %v", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != tt.wantStatus {
				t.Fatalf("status=%d, want %d", resp.StatusCode, tt.wantStatus)
			}
			if resp.StatusCode == http.StatusOK {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					t.Fatalf("read body: %v", err)
				}
				if got := strings.TrimSpace(string(body)); got != tt.want {
					t.Errorf("client IP=%q, want %q", got, tt.want)
				}
			}
		})
	}
}
