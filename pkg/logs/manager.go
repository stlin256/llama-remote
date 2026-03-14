package logs

import (
	"encoding/json"
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
