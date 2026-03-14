package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"time"

	"github.com/llama-remote/server/pkg/config"
)

const (
	CookieName    = "llama_remote_auth"
	CookieMaxAge  = 30 * 24 * time.Hour // 30 days
	SessionLength = 30 * 24 * time.Hour
)

type Manager struct {
	cfg *config.Config
}

func NewManager(cfg *config.Config) *Manager {
	return &Manager{cfg: cfg}
}

func (m *Manager) IsEnabled() bool {
	return m.cfg.Auth.Enable && m.cfg.Auth.Password != ""
}

func (m *Manager) hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return hex.EncodeToString(hash[:])
}

func (m *Manager) ValidatePassword(password string) bool {
	if !m.cfg.Auth.Enable {
		return true // Auth disabled, allow all
	}
	if m.cfg.Auth.Password == "" {
		return true // No password configured, allow all
	}
	return m.hashPassword(password) == m.hashPassword(m.cfg.Auth.Password)
}

// Middleware returns a handler that checks authentication
func (m *Manager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip auth check if auth is disabled
		if !m.IsEnabled() {
			next.ServeHTTP(w, r)
			return
		}

		// Check for valid session cookie
		cookie, err := r.Cookie(CookieName)
		if err != nil || cookie.Value == "" {
			// No valid cookie, return 401
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		// Validate session (simple hash of password + timestamp)
		expectedValue := m.hashPassword(m.cfg.Auth.Password + "session")
		if cookie.Value != expectedValue {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// HandleLogin handles login requests
func (m *Manager) HandleLogin() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		if !m.ValidatePassword(req.Password) {
			http.Error(w, `{"error":"invalid password"}`, http.StatusUnauthorized)
			return
		}

		// Create session cookie
		sessionValue := m.hashPassword(m.cfg.Auth.Password + "session")
		cookie := &http.Cookie{
			Name:     CookieName,
			Value:    sessionValue,
			Path:     "/",
			MaxAge:   int(CookieMaxAge.Seconds()),
			HttpOnly: true,
			// Secure:   true, // Enable in production with HTTPS
		}
		http.SetCookie(w, cookie)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// HandleLogout handles logout requests
func (m *Manager) HandleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Clear session cookie
		cookie := &http.Cookie{
			Name:   CookieName,
			Value:  "",
			Path:   "/",
			MaxAge: -1,
		}
		http.SetCookie(w, cookie)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// HandleCheck checks if user is authenticated
func (m *Manager) HandleCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// If auth is disabled, always return authenticated
		if !m.IsEnabled() {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]bool{"authenticated": true})
			return
		}

		// Check for valid session cookie
		cookie, err := r.Cookie(CookieName)
		if err != nil || cookie.Value == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]bool{"authenticated": false})
			return
		}

		expectedValue := m.hashPassword(m.cfg.Auth.Password + "session")
		authenticated := cookie.Value == expectedValue

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"authenticated": authenticated})
	}
}
