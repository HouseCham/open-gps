package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/gofiber/fiber/v3/log"
	"github.com/joho/godotenv"
)

func LoadEnv() {
	log.Info("Setting up environment variables")
	if err := godotenv.Load(); err != nil {
		log.Warnf("Could not load .env file: %v", err)
	}
}

type AuthConfig struct {
	AppName     string `json:"appName"`
	BaseURL     string `json:"baseURL"`
	Secret      string `json:"-"`
	DatabaseURL string `json:"-"`
}

func LoadAuthConfig() (AuthConfig, error) {
	cfg := AuthConfig{
		AppName:     getEnvDefault("APP_NAME", "gps-tracker-api"),
		BaseURL:     os.Getenv("AUTHULA_BASE_URL"),
		Secret:      os.Getenv("AUTHULA_SECRET"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	if cfg.Secret == "" {
		return AuthConfig{}, fmt.Errorf("authula_secret is required")
	}
	if cfg.DatabaseURL == "" {
		return AuthConfig{}, fmt.Errorf("database_url is required")
	}
	return cfg, nil
}

func getEnvDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// LoadCORSOrigins returns the list of allowed origins for the
// CORS middleware, parsed from the CORS_ALLOWED_ORIGINS env var
// (comma-separated). Empty/missing means CORS is left disabled
// (the router skips mounting the middleware).
func LoadCORSOrigins() []string {
	v := os.Getenv("CORS_ALLOWED_ORIGINS")
	if v == "" {
		return nil
	}
	var origins []string
	for _, o := range strings.Split(v, ",") {
		if o = strings.TrimSpace(o); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

// LoadPublicOrigin returns the public application origin from
// PUBLIC_APP_ORIGIN. It is used to build password-reset links
// entirely server-side: the value must be a bare origin (scheme +
// host, no path, query or fragment) so a request cannot influence
// the link destination. Trailing slashes are stripped so callers
// can concatenate paths directly.
func LoadPublicOrigin() (string, error) {
	v := os.Getenv("PUBLIC_APP_ORIGIN")
	if v == "" {
		return "", fmt.Errorf("public_app_origin is required")
	}
	u, err := url.Parse(v)
	if err != nil {
		return "", fmt.Errorf("public_app_origin is invalid: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", fmt.Errorf("public_app_origin must use http or https")
	}
	if u.Host == "" {
		return "", fmt.Errorf("public_app_origin must include a host")
	}
	// userinfo (https://trusted.example@attacker.example) would make
	// browsers navigate to the @-side host and leak the reset token.
	if u.User != nil {
		return "", fmt.Errorf("public_app_origin must not include userinfo")
	}
	if u.Path != "" && u.Path != "/" {
		return "", fmt.Errorf("public_app_origin must not include a path")
	}
	if u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("public_app_origin must not include a query or fragment")
	}
	return strings.TrimSuffix(v, "/"), nil
}
