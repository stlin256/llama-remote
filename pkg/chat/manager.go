package chat

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/llama-remote/server/pkg/instance"
)

// Manager handles chat API requests
type Manager struct {
	instanceMgr *instance.Manager
	history     map[string][]Message
	mu          sync.RWMutex
	httpClient  *http.Client
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents a chat API request
type ChatRequest struct {
	Messages    []Message `json:"messages"`
	InstanceID  string    `json:"instance_id"`
	Stream      bool      `json:"stream"`
}

// ChatResponse represents a chat API response
type ChatResponse struct {
	ID      string   `json:"id"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// StreamChunk represents a streaming response chunk
type StreamChunk struct {
	ID      string   `json:"id"`
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []struct {
		Index        int         `json:"index"`
		Delta        Message     `json:"delta"`
		FinishReason string      `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// SpeedInfo represents token speed information
type SpeedInfo struct {
	TokensPerSecond float64 `json:"tokens_per_second"`
	TotalTokens     int     `json:"total_tokens"`
	DurationMs      int64   `json:"duration_ms"`
}

// NewManager creates a new chat manager
func NewManager(instanceMgr *instance.Manager) *Manager {
	return &Manager{
		instanceMgr: instanceMgr,
		history:     make(map[string][]Message),
		httpClient: &http.Client{
			Timeout: 300 * time.Second,
		},
	}
}

// HandleChat handles POST /api/chat
func (m *Manager) HandleChat() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, fmt.Sprintf("invalid request body: %v", err), 400)
			return
		}

		// Validate instance_id
		if req.InstanceID == "" {
			http.Error(w, "instance_id is required", 400)
			return
		}

		// Get instance
		inst, ok := m.instanceMgr.Get(req.InstanceID)
		if !ok {
			http.Error(w, "instance not found", 404)
			return
		}

		// Check if instance is running
		if inst.Status != "running" {
			http.Error(w, "instance is not running", 400)
			return
		}

		// Get port
		port := inst.Port
		if port <= 0 {
			if p, ok := inst.Params["port"].(float64); ok {
				port = int(p)
			}
		}
		if port <= 0 {
			port = 5000
		}

		// Build llama-server URL
		serverURL := fmt.Sprintf("http://127.0.0.1:%d/v1/chat/completions", port)

		// Add conversation history to messages
		allMessages := m.getHistory(req.InstanceID)
		allMessages = append(allMessages, req.Messages...)

		// Prepare request to llama-server
		llamaReq := map[string]interface{}{
			"messages": allMessages,
			"stream":   req.Stream,
		}

		if req.Stream {
			m.handleStreamingChat(w, r, serverURL, llamaReq, req.InstanceID, req.Messages)
		} else {
			m.handleNonStreamingChat(w, r, serverURL, llamaReq, req.InstanceID, req.Messages)
		}
	}
}

func (m *Manager) handleStreamingChat(w http.ResponseWriter, r *http.Request, serverURL string, llamaReq map[string]interface{}, instanceID string, newMessages []Message) {
	// Convert request to JSON
	reqBody, err := json.Marshal(llamaReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal request: %v", err), 500)
		return
	}

	// Create request to llama-server
	req, err := http.NewRequest("POST", serverURL, strings.NewReader(string(reqBody)))
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create request: %v", err), 500)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	// Make request
	resp, err := m.httpClient.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to call llama-server: %v", err), 502)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("llama-server error: %s", string(body)), 502)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", 500)
		return
	}

	// Track tokens for speed calculation
	startTime := time.Now()
	totalTokens := 0
	promptTokens := 0
	var currentContent strings.Builder

	// Increase scanner buffer for large responses
	const maxScanTokenSize = 1024 * 1024 // 1MB
	buf := make([]byte, maxScanTokenSize)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(buf, maxScanTokenSize)

	for scanner.Scan() {
		line := scanner.Text()

		// Skip empty lines
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			// Send final speed info with actual token counts
			duration := time.Since(startTime)
			tokensPerSecond := float64(totalTokens) / duration.Seconds()

			speedData := map[string]interface{}{
				"id":                "speed",
				"choices":           []interface{}{},
				"tokens_per_second": tokensPerSecond,
				"total_tokens":      totalTokens,
				"prompt_tokens":     promptTokens,
				"duration_ms":       duration.Milliseconds(),
			}
			speedJSON, _ := json.Marshal(speedData)
			fmt.Fprintf(w, "data: %s\n\n", speedJSON)
			flusher.Flush()
			break
		}

		var chunk StreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		// Get actual token counts from chunk
		if chunk.Usage.PromptTokens > 0 {
			promptTokens = chunk.Usage.PromptTokens
		}
		if chunk.Usage.CompletionTokens > 0 {
			totalTokens = chunk.Usage.CompletionTokens
		} else if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			// Fallback: estimate if usage not provided
			content := chunk.Choices[0].Delta.Content
			currentContent.WriteString(content)
		}

		// Forward the chunk to client
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()

		// Check if client disconnected
		select {
		case <-r.Context().Done():
			// Client disconnected, save partial response if any
			m.addToHistory(instanceID, newMessages)
			if currentContent.Len() > 0 {
				m.addToHistory(instanceID, []Message{{Role: "assistant", Content: currentContent.String()}})
			}
			return
		default:
		}
	}

	// Save to history
	m.addToHistory(instanceID, newMessages)
	m.addToHistory(instanceID, []Message{{Role: "assistant", Content: currentContent.String()}})
}

func (m *Manager) handleNonStreamingChat(w http.ResponseWriter, r *http.Request, serverURL string, llamaReq map[string]interface{}, instanceID string, newMessages []Message) {
	// Convert request to JSON
	reqBody, err := json.Marshal(llamaReq)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to marshal request: %v", err), 500)
		return
	}

	// Create request to llama-server
	req, err := http.NewRequest("POST", serverURL, strings.NewReader(string(reqBody)))
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create request: %v", err), 500)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	// Make request
	startTime := time.Now()
	resp, err := m.httpClient.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to call llama-server: %v", err), 502)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("llama-server error: %s", string(body)), 502)
		return
	}

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to read response: %v", err), 500)
		return
	}

	// Parse response
	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		http.Error(w, fmt.Sprintf("failed to parse response: %v", err), 500)
		return
	}

	// Calculate speed
	duration := time.Since(startTime)
	totalTokens := chatResp.Usage.TotalTokens
	var tokensPerSecond float64
	if duration.Seconds() > 0 {
		tokensPerSecond = float64(totalTokens) / duration.Seconds()
	}

	// Add speed info to response
	speedInfo := SpeedInfo{
		TokensPerSecond: tokensPerSecond,
		TotalTokens:     totalTokens,
		DurationMs:      duration.Milliseconds(),
	}

	// Combine response with speed info
	result := map[string]interface{}{
		"response":  chatResp,
		"speed":     speedInfo,
	}

	// Save to history
	if len(chatResp.Choices) > 0 {
		m.addToHistory(instanceID, newMessages)
		m.addToHistory(instanceID, []Message{chatResp.Choices[0].Message})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleHistory handles GET/DELETE /api/chat/history
func (m *Manager) HandleHistory() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.URL.Query().Get("instance_id")
		if instanceID == "" {
			http.Error(w, "instance_id is required", 400)
			return
		}

		if r.Method == http.MethodGet {
			// Get history
			m.mu.RLock()
			history := m.history[instanceID]
			m.mu.RUnlock()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"instance_id": instanceID,
				"messages":    history,
				"count":       len(history),
			})
		} else if r.Method == http.MethodDelete {
			// Clear history
			m.mu.Lock()
			delete(m.history, instanceID)
			m.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
		}
	}
}

// HandleModels handles GET /api/chat/models
func (m *Manager) HandleModels() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get all running instances
		instances := m.instanceMgr.List()

		type ModelInfo struct {
			InstanceID string `json:"instance_id"`
			InstanceName string `json:"instance_name"`
			Model       string `json:"model"`
			Status      string `json:"status"`
			Port        int    `json:"port"`
		}

		var models []ModelInfo
		for _, inst := range instances {
			if inst.Status == "running" && inst.Model != "" {
				models = append(models, ModelInfo{
					InstanceID:   inst.ID,
					InstanceName: inst.Name,
					Model:        inst.Model,
					Status:       inst.Status,
					Port:         inst.Port,
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"models": models,
			"count":  len(models),
		})
	}
}

func (m *Manager) getHistory(instanceID string) []Message {
	m.mu.RLock()
	defer m.mu.RUnlock()
	history := m.history[instanceID]
	// Return a copy to prevent mutation
	result := make([]Message, len(history))
	copy(result, history)
	return result
}

func (m *Manager) addToHistory(instanceID string, messages []Message) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.history[instanceID] == nil {
		m.history[instanceID] = []Message{}
	}
	m.history[instanceID] = append(m.history[instanceID], messages...)

	// Limit history to 100 messages (50 pairs)
	if len(m.history[instanceID]) > 100 {
		m.history[instanceID] = m.history[instanceID][len(m.history[instanceID])-100:]
	}
}
