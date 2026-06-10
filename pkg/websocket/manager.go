package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/llama-remote/server/pkg/auth"
	"github.com/llama-remote/server/pkg/gpu"
)

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type Manager struct {
	authenticator *auth.Manager
	upgrader      websocket.Upgrader
	clients       map[*websocket.Conn]bool
	mu            sync.RWMutex
}

func NewManager(authenticator *auth.Manager) *Manager {
	manager := &Manager{
		authenticator: authenticator,
		clients:       make(map[*websocket.Conn]bool),
	}
	manager.upgrader.CheckOrigin = manager.checkOrigin
	return manager
}

func (m *Manager) Handle(w http.ResponseWriter, r *http.Request) {
	if m.authenticator != nil && !m.authenticator.ValidateRequest(r) {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	conn, err := m.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	m.mu.Lock()
	m.clients[conn] = true
	m.mu.Unlock()

	defer func() {
		m.mu.Lock()
		delete(m.clients, conn)
		m.mu.Unlock()
		conn.Close()
	}()

	// 保持连接
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (m *Manager) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" {
		return false
	}
	return parsed.Host == r.Host
}

func (m *Manager) Broadcast(msg Message) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	data, _ := json.Marshal(msg)
	for conn := range m.clients {
		conn.WriteMessage(websocket.TextMessage, data)
	}
}

func (m *Manager) BroadcastStats(stats gpu.Stats) {
	m.Broadcast(Message{
		Type:    "stats",
		Payload: stats,
	})
}

func (m *Manager) BroadcastInstanceStatus(instanceID, status string) {
	m.Broadcast(Message{
		Type: "instance_status",
		Payload: map[string]string{
			"id":     instanceID,
			"status": status,
		},
	})
}

func (m *Manager) BroadcastInstanceError(instanceID, errorMsg string) {
	m.Broadcast(Message{
		Type: "instance_error",
		Payload: map[string]string{
			"id":      instanceID,
			"message": errorMsg,
		},
	})
}

func (m *Manager) BroadcastLog(instanceID, logLine string) {
	m.Broadcast(Message{
		Type: "log",
		Payload: map[string]string{
			"instance": instanceID,
			"content":  logLine,
		},
	})
}

func (m *Manager) BroadcastSystemStats(stats gpu.SystemStats) {
	m.Broadcast(Message{
		Type:    "system",
		Payload: stats,
	})
}

func (m *Manager) BroadcastInstanceProgress(instanceID, progress, message string) {
	m.Broadcast(Message{
		Type: "instance_progress",
		Payload: map[string]string{
			"id":       instanceID,
			"progress": progress,
			"message":  message,
		},
	})
}
