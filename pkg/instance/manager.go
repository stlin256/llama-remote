package instance

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/llama-remote/server/pkg/config"
	"github.com/llama-remote/server/pkg/logs"
	"github.com/llama-remote/server/pkg/websocket"

	"github.com/google/uuid"
)

type Instance struct {
	ID             string            `yaml:"id"`
	Name           string            `yaml:"name"`
	LlamaBin       string            `yaml:"llama_bin"`
	Model          string            `yaml:"model"`
	Mmproj         string            `yaml:"mmproj"`
	Params         map[string]interface{} `yaml:"params"`
	PromptTemplate string            `yaml:"prompt_template"`
	Status         string            `yaml:"status"` // stopped, starting, running, error
	PID            int               `yaml:"-"`
	LogFile        string            `yaml:"-"`
	Port           int               `yaml:"port"`
}

type Manager struct {
	cfg        *config.Config
	instances  map[string]*Instance
	mu         sync.RWMutex
	logManager *logs.Manager
}

func NewManager(cfg *config.Config, logManager *logs.Manager) *Manager {
	m := &Manager{
		cfg:        cfg,
		instances:  make(map[string]*Instance),
		logManager: logManager,
	}
	m.loadInstances()
	return m
}

func (m *Manager) loadInstances() {
	// 加载已保存的实例配置
	// TODO: 从文件加载
}

func (m *Manager) saveInstances() {
	// 保存实例配置到文件
	// TODO: 保存到文件
}

func (m *Manager) List() []*Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		result = append(result, inst)
	}
	return result
}

func (m *Manager) Get(id string) (*Instance, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	inst, ok := m.instances[id]
	return inst, ok
}

func (m *Manager) Create(inst *Instance) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if inst.ID == "" {
		inst.ID = uuid.New().String()
	}
	if inst.Name == "" {
		inst.Name = "Instance " + inst.ID[:8]
	}
	if inst.Status == "" {
		inst.Status = "stopped"
	}

	m.instances[inst.ID] = inst
	m.saveInstances()
	return nil
}

func (m *Manager) Update(inst *Instance) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.instances[inst.ID]; !ok {
		return fmt.Errorf("instance not found")
	}

	m.instances[inst.ID] = inst
	m.saveInstances()
	return nil
}

func (m *Manager) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if inst, ok := m.instances[id]; ok {
		if inst.Status == "running" {
			m.stopInstance(inst)
		}
	}

	delete(m.instances, id)
	m.saveInstances()
	return nil
}

func (m *Manager) Start(id string) error {
	m.mu.Lock()
	inst, ok := m.instances[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("instance not found")
	}
	if inst.Status == "running" {
		m.mu.Unlock()
		return fmt.Errorf("instance already running")
	}
	inst.Status = "starting"
	m.mu.Unlock()

	// 构建命令行参数
	args := []string{}
	if inst.LlamaBin != "" {
		// 使用实例指定的llama-server
	} else if m.cfg.Paths.LlamaBin != "" {
		inst.LlamaBin = m.cfg.Paths.LlamaBin
	} else {
		return fmt.Errorf("llama.cpp binary not configured")
	}

	// 添加模型参数
	if inst.Model != "" {
		args = append(args, "-m", inst.Model)
	}

	// 添加mmproj参数
	if inst.Mmproj != "" {
		args = append(args, "--mmproj", inst.Mmproj)
	}

	// 添加其他参数
	if port, ok := inst.Params["port"].(float64); ok {
		inst.Port = int(port)
		args = append(args, "--port", fmt.Sprintf("%d", int(port)))
	} else {
		inst.Port = 8080
		args = append(args, "--port", "8080")
	}

	if host, ok := inst.Params["host"].(string); ok {
		args = append(args, "--host", host)
	} else {
		args = append(args, "--host", "0.0.0.0")
	}

	if ngl, ok := inst.Params["ngl"].(float64); ok {
		args = append(args, "-ngl", fmt.Sprintf("%d", int(ngl)))
	}

	if context, ok := inst.Params["context"].(float64); ok {
		args = append(args, "-c", fmt.Sprintf("%d", int(context)))
	}

	if threads, ok := inst.Params["threads"].(float64); ok {
		args = append(args, "-t", fmt.Sprintf("%d", int(threads)))
	}

	if fa, ok := inst.Params["flash_attention"].(bool); ok && fa {
		args = append(args, "-fa")
	}

	if mlock, ok := inst.Params["mlock"].(bool); ok && mlock {
		args = append(args, "-mlock")
	}

	if noMap, ok := inst.Params["no-mmap"].(bool); ok && noMap {
		args = append(args, "--no-mmap")
	}

	if batchSize, ok := inst.Params["batch_size"].(float64); ok {
		args = append(args, "-b", fmt.Sprintf("%d", int(batchSize)))
	}

	// 创建日志文件
	logFile := filepath.Join(m.cfg.LogDir, fmt.Sprintf("%s.log", inst.ID))
	inst.LogFile = logFile

	// 打开日志文件
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		inst.Status = "error"
		return fmt.Errorf("failed to open log file: %w", err)
	}

	// 创建命令
	cmd := exec.Command(inst.LlamaBin, args...)
	cmd.Stdout = f
	cmd.Stderr = f

	// 启动进程
	if err := cmd.Start(); err != nil {
		f.Close()
		inst.Status = "error"
		return fmt.Errorf("failed to start llama-server: %w", err)
	}

	inst.PID = cmd.Process.Pid
	inst.Status = "running"

	m.mu.Lock()
	m.instances[inst.ID] = inst
	m.mu.Unlock()

	// 启动日志读取协程
	go m.readLog(inst, f)
	f.Close()

	// 等待服务真正启动
	time.Sleep(2 * time.Second)

	// 检查进程是否还在运行
	if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
		inst.Status = "error"
		return fmt.Errorf("llama-server exited unexpectedly")
	}

	m.saveInstances()
	return nil
}

func (m *Manager) readLog(inst *Instance, f *os.File) {
	// 读取日志文件并通过WebSocket推送
	// 简化实现：定期读取新内容
}

func (m *Manager) Stop(id string) error {
	m.mu.Lock()
	inst, ok := m.instances[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("instance not found")
	}
	m.mu.Unlock()

	return m.stopInstance(inst)
}

func (m *Manager) stopInstance(inst *Instance) error {
	if inst.PID > 0 {
		proc, err := os.FindProcess(inst.PID)
		if err == nil {
			proc.Kill()
		}
	}
	inst.Status = "stopped"
	inst.PID = 0
	m.saveInstances()
	return nil
}

func (m *Manager) StopAll() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, inst := range m.instances {
		if inst.Status == "running" {
			m.stopInstance(inst)
		}
	}
}

func (m *Manager) WatchStatus(wsMgr *websocket.Manager) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.RLock()
		for _, inst := range m.instances {
			if inst.Status == "running" && inst.PID > 0 {
				proc, err := os.FindProcess(inst.PID)
				if err != nil {
					inst.Status = "error"
					wsMgr.BroadcastInstanceStatus(inst.ID, "error")
				} else if proc.Pid < 0 {
					// Process doesn't exist
					inst.Status = "error"
					wsMgr.BroadcastInstanceStatus(inst.ID, "error")
				}
			}
		}
		m.mu.RUnlock()
	}
}
