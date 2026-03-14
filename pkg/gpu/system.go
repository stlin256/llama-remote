package gpu

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

type SystemStats struct {
	CPU float64 `json:"cpu"`     // %
	MemUsed  float64 `json:"mem_used"`  // GB
	MemTotal float64 `json:"mem_total"` // GB
	MemPercent float64 `json:"mem_percent"` // %
}

type MonitorEx struct {
	stats    SystemStats
	mu       sync.RWMutex
	statsCh  chan SystemStats
	stopCh   chan struct{}
}

func NewMonitorEx() *MonitorEx {
	return &MonitorEx{
		stats:   SystemStats{},
		statsCh: make(chan SystemStats, 10),
		stopCh:  make(chan struct{}),
	}
}

func (m *MonitorEx) Start() {
	go m.poll()
}

func (m *MonitorEx) Stop() {
	close(m.stopCh)
}

func (m *MonitorEx) Stats() <-chan SystemStats {
	return m.statsCh
}

func (m *MonitorEx) Get() SystemStats {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.stats
}

func (m *MonitorEx) poll() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopCh:
			return
		case <-ticker.C:
			stats := m.querySystem()
			m.mu.Lock()
			m.stats = stats
			m.mu.Unlock()
			select {
			case m.statsCh <- stats:
			default:
			}
		}
	}
}

func (m *MonitorEx) querySystem() SystemStats {
	stats := SystemStats{}

	// Get CPU usage
	cmd := exec.Command("sh", "-c", "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'")
	output, err := cmd.Output()
	if err == nil {
		cpu, _ := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
		stats.CPU = cpu
	}

	// Get memory usage
	cmd = exec.Command("sh", "-c", "free -g | grep Mem | awk '{print $2,$3}'")
	output, err = cmd.Output()
	if err == nil {
		parts := strings.Fields(strings.TrimSpace(string(output)))
		if len(parts) >= 2 {
			total, _ := strconv.ParseFloat(parts[0], 64)
			used, _ := strconv.ParseFloat(parts[1], 64)
			stats.MemTotal = total
			stats.MemUsed = used
			if total > 0 {
				stats.MemPercent = (used / total) * 100
			}
		}
	}

	return stats
}

func (m *MonitorEx) HandleGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats := m.Get()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}
}
