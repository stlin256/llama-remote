package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/llama-remote/server/pkg/config"
)

const (
	CookieName    = "llama_remote_auth"
	CookieMaxAge  = 30 * 24 * time.Hour // 30 days
	SessionLength = 30 * 24 * time.Hour
)

type Manager struct {
	cfg      *config.Config
	mu       sync.Mutex
	sessions map[string]session
}

type session struct {
	ExpiresAt    time.Time
	PasswordHash string
}

func NewManager(cfg *config.Config) *Manager {
	return &Manager{
		cfg:      cfg,
		sessions: make(map[string]session),
	}
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
	return subtle.ConstantTimeCompare(
		[]byte(m.hashPassword(password)),
		[]byte(m.currentPasswordHash()),
	) == 1
}

func (m *Manager) currentPasswordHash() string {
	return m.hashPassword(m.cfg.Auth.Password)
}

func (m *Manager) newSession() (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cleanupExpiredLocked(time.Now())
	m.sessions[token] = session{
		ExpiresAt:    time.Now().Add(SessionLength),
		PasswordHash: m.currentPasswordHash(),
	}
	return token, nil
}

func (m *Manager) deleteSession(token string) {
	if token == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, token)
}

func (m *Manager) cleanupExpiredLocked(now time.Time) {
	for token, sess := range m.sessions {
		if now.After(sess.ExpiresAt) {
			delete(m.sessions, token)
		}
	}
}

func (m *Manager) ValidateRequest(r *http.Request) bool {
	if !m.IsEnabled() {
		return true
	}

	cookie, err := r.Cookie(CookieName)
	if err != nil || cookie.Value == "" {
		return false
	}

	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cleanupExpiredLocked(now)
	sess, ok := m.sessions[cookie.Value]
	if !ok {
		return false
	}
	if sess.PasswordHash != m.currentPasswordHash() {
		delete(m.sessions, cookie.Value)
		return false
	}
	if now.After(sess.ExpiresAt) {
		delete(m.sessions, cookie.Value)
		return false
	}
	return true
}

// Middleware returns a handler that checks authentication
func (m *Manager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !m.ValidateRequest(r) {
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

		sessionValue, err := m.newSession()
		if err != nil {
			http.Error(w, `{"error":"failed to create session"}`, http.StatusInternalServerError)
			return
		}
		cookie := &http.Cookie{
			Name:     CookieName,
			Value:    sessionValue,
			Path:     "/",
			MaxAge:   int(CookieMaxAge.Seconds()),
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		}
		http.SetCookie(w, cookie)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// HandleLogout handles logout requests
func (m *Manager) HandleLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(CookieName); err == nil {
			m.deleteSession(cookie.Value)
		}

		// Clear session cookie
		cookie := &http.Cookie{
			Name:     CookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		}
		http.SetCookie(w, cookie)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// HandleCheck checks if user is authenticated
func (m *Manager) HandleCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"authenticated": m.ValidateRequest(r)})
	}
}
