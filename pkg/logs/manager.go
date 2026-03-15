package logs

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type Manager struct {
	logDir string
}

func NewManager(logDir string) *Manager {
	return &Manager{logDir: logDir}
}

func (m *Manager) Close() {
	// 清理资源
}

// GetRecentLogs 获取最近的日志行
func (m *Manager) GetRecentLogs(instanceID string, lines int) string {
	logFile := filepath.Join(m.logDir, instanceID+".log")
	data, err := os.ReadFile(logFile)
	if err != nil {
		return ""
	}

	allLines := strings.Split(string(data), "\n")
	if len(allLines) <= lines {
		return strings.Join(allLines, "\n")
	}

	// 返回最后N行
	return strings.Join(allLines[len(allLines)-lines:], "\n")
}

func (m *Manager) HandleGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.URL.Query().Get("instance")
		var logs []string

		if instanceID != "" {
			logFile := filepath.Join(m.logDir, instanceID+".log")
			if data, err := os.ReadFile(logFile); err == nil {
				logs = strings.Split(string(data), "\n")
			}
		} else {
			// 列出所有日志文件
			entries, _ := os.ReadDir(m.logDir)
			for _, e := range entries {
				if !e.IsDir() && strings.HasSuffix(e.Name(), ".log") {
					logs = append(logs, e.Name())
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"logs": logs})
	}
}

func (m *Manager) HandleStream(wsMgr interface{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// WebSocket流处理在websocket包中
	}
}

// HandleServerLog 获取服务器日志
func (m *Manager) HandleServerLog() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lines := r.URL.Query().Get("lines")
		maxLines := 100
		if lines != "" {
			fmt.Sscanf(lines, "%d", &maxLines)
		}

		// 读取服务器日志
		logFile := "/tmp/llama-remote.log"
		data, err := os.ReadFile(logFile)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"logs": []string{}, "error": err.Error()})
			return
		}

		logLines := strings.Split(string(data), "\n")
		if len(logLines) > maxLines {
			logLines = logLines[len(logLines)-maxLines:]
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"logs": logLines})
	}
}
