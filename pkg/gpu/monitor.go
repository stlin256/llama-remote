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

type Stats struct {
	Index       int     `json:"index"`
	Name        string  `json:"name"`
	Utilization float64 `json:"utilization"` // %
	MemoryUsed  float64 `json:"memory_used"` // GB
	MemoryTotal float64 `json:"memory_total"` // GB
	Temperature int     `json:"temperature"` // C
	FanSpeed    int     `json:"fan_speed"` // %
	Power       float64 `json:"power"` // W
	PerfLimit   string  `json:"perf_limit"` // Performance Limited Reason
	MemoryLoad  string  `json:"memory_load"` // Low/Medium/High
}

type Monitor struct {
	stats    Stats
	mu       sync.RWMutex
	statsCh  chan Stats
	stopCh   chan struct{}
}

func NewMonitor() *Monitor {
	return &Monitor{
		stats:   Stats{},
		statsCh: make(chan Stats, 10),
		stopCh:  make(chan struct{}),
	}
}

func (m *Monitor) Start() {
	go m.poll()
}

func (m *Monitor) Stop() {
	close(m.stopCh)
}

func (m *Monitor) Stats() <-chan Stats {
	return m.statsCh
}

func (m *Monitor) Get() Stats {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.stats
}

func (m *Monitor) poll() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopCh:
			return
		case <-ticker.C:
			stats := m.queryGPU()
			if stats.Name != "" {
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
}

func (m *Monitor) queryGPU() Stats {
	cmd := exec.Command("nvidia-smi", "--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,fan.speed,power.draw,performance.limit,memory.load",
		"--format=csv,noheader,nounits")

	output, err := cmd.Output()
	if err != nil {
		return Stats{}
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) == 0 {
		return Stats{}
	}

	// 只取第一个GPU
	parts := strings.Split(lines[0], ",")
	if len(parts) < 10 {
		return Stats{}
	}

	stats := Stats{}

	stats.Index, _ = strconv.Atoi(strings.TrimSpace(parts[0]))
	stats.Name = strings.TrimSpace(parts[1])
	stats.Utilization, _ = strconv.ParseFloat(strings.TrimSpace(parts[2]), 64)
	stats.MemoryUsed, _ = strconv.ParseFloat(strings.TrimSpace(parts[3]), 64)
	stats.MemoryUsed /= 1024 // MB to GB
	stats.MemoryTotal, _ = strconv.ParseFloat(strings.TrimSpace(parts[4]), 64)
	stats.MemoryTotal /= 1024 // MB to GB
	stats.Temperature, _ = strconv.Atoi(strings.TrimSpace(parts[5]))
	stats.FanSpeed, _ = strconv.Atoi(strings.TrimSpace(parts[6]))
	stats.Power, _ = strconv.ParseFloat(strings.TrimSpace(parts[7]), 64)
	stats.PerfLimit = strings.TrimSpace(parts[8])
	stats.MemoryLoad = strings.TrimSpace(parts[9])

	return stats
}

func (m *Monitor) HandleGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats := m.Get()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}
}
