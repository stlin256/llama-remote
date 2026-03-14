package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/llama-remote/server/pkg/gpu"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

type Manager struct {
	clients map[*websocket.Conn]bool
	mu      sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{
		clients: make(map[*websocket.Conn]bool),
	}
}

func (m *Manager) Handle(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
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

func (m *Manager) BroadcastLog(instanceID, logLine string) {
	m.Broadcast(Message{
		Type: "log",
		Payload: map[string]string{
			"instance": instanceID,
			"content":  logLine,
		},
	})
}
