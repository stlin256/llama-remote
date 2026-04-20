package gpu

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type SystemStats struct {
	CPU        float64 `json:"cpu"`         // %
	MemUsed    float64 `json:"mem_used"`    // GB
	MemTotal   float64 `json:"mem_total"`   // GB
	MemPercent float64 `json:"mem_percent"` // %
}

type MonitorEx struct {
	stats        SystemStats
	mu           sync.RWMutex
	statsCh      chan SystemStats
	stopCh       chan struct{}
	prevIdle     uint64
	prevTotal    uint64
	prevCPUValid bool
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

	totalCPU, idleCPU, err := readCPUSample()
	if err == nil {
		if m.prevCPUValid && totalCPU > m.prevTotal && idleCPU >= m.prevIdle {
			deltaTotal := totalCPU - m.prevTotal
			deltaIdle := idleCPU - m.prevIdle
			if deltaTotal > 0 {
				stats.CPU = float64(deltaTotal-deltaIdle) * 100 / float64(deltaTotal)
			}
		}
		m.prevTotal = totalCPU
		m.prevIdle = idleCPU
		m.prevCPUValid = true
	}

	memTotalKB, memAvailableKB, err := readMemInfo()
	if err == nil && memTotalKB > 0 {
		memUsedKB := memTotalKB - memAvailableKB
		stats.MemTotal = float64(memTotalKB) / 1024 / 1024
		stats.MemUsed = float64(memUsedKB) / 1024 / 1024
		stats.MemPercent = float64(memUsedKB) * 100 / float64(memTotalKB)
	}

	return stats
}

func readCPUSample() (uint64, uint64, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0, err
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 0, 0, os.ErrInvalid
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return 0, 0, os.ErrInvalid
	}

	var total uint64
	for _, field := range fields[1:] {
		value, convErr := strconv.ParseUint(field, 10, 64)
		if convErr != nil {
			return 0, 0, convErr
		}
		total += value
	}

	idle, err := strconv.ParseUint(fields[4], 10, 64)
	if err != nil {
		return 0, 0, err
	}
	if len(fields) > 5 {
		iowait, convErr := strconv.ParseUint(fields[5], 10, 64)
		if convErr != nil {
			return 0, 0, convErr
		}
		idle += iowait
	}

	return total, idle, nil
}

func readMemInfo() (uint64, uint64, error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}

	var totalKB uint64
	var availableKB uint64

	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		switch strings.TrimSuffix(fields[0], ":") {
		case "MemTotal":
			totalKB, err = strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, 0, err
			}
		case "MemAvailable":
			availableKB, err = strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, 0, err
			}
		}
	}

	if totalKB == 0 {
		return 0, 0, os.ErrInvalid
	}

	return totalKB, availableKB, nil
}

func (m *MonitorEx) HandleGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stats := m.Get()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}
}
