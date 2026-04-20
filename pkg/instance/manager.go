package instance

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/llama-remote/server/pkg/config"
	"github.com/llama-remote/server/pkg/logs"
	"github.com/llama-remote/server/pkg/websocket"

	"github.com/google/uuid"
	"gopkg.in/yaml.v3"
)

type Instance struct {
	ID             string                 `yaml:"id" json:"id"`
	Name           string                 `yaml:"name" json:"name"`
	Model          string                 `yaml:"model" json:"model"`
	Mmproj         string                 `yaml:"mmproj" json:"mmproj"`
	Params         map[string]interface{} `yaml:"params" json:"params"`
	PromptTemplate string                 `yaml:"prompt_template" json:"prompt_template"`
	Status         string                 `yaml:"status" json:"status"`
	Port           int                    `yaml:"port" json:"port"`
	PID            int                    `yaml:"-" json:"-"`
	LogFile        string                 `yaml:"-" json:"-"`
}

type InstanceData struct {
	Instances []Instance `yaml:"instances"`
}

type Manager struct {
	cfg        *config.Config
	instances  map[string]*Instance
	mu         sync.RWMutex
	logManager *logs.Manager
	wsManager  *websocket.Manager
	dataFile   string
}

func NewManager(cfg *config.Config, logManager *logs.Manager, wsManager *websocket.Manager) *Manager {
	m := &Manager{
		cfg:        cfg,
		instances:  make(map[string]*Instance),
		logManager: logManager,
		wsManager:  wsManager,
		dataFile:   filepath.Join(cfg.DataDir, "instances.yaml"),
	}
	m.loadInstances()
	return m
}

func (m *Manager) loadInstances() {
	data, err := os.ReadFile(m.dataFile)
	if err != nil {
		// 文件不存在或读取失败，使用空列表
		return
	}

	var instanceData InstanceData
	if err := yaml.Unmarshal(data, &instanceData); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load instances: %v\n", err)
		return
	}

	for i := range instanceData.Instances {
		inst := &instanceData.Instances[i]
		inst.Status = "stopped"
		m.instances[inst.ID] = inst
	}
}

func (m *Manager) saveInstances() {
	instanceData := InstanceData{
		Instances: make([]Instance, 0, len(m.instances)),
	}

	for _, inst := range m.instances {
		instanceData.Instances = append(instanceData.Instances, *inst)
	}

	data, err := yaml.Marshal(instanceData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal instances: %v\n", err)
		return
	}

	if err := os.WriteFile(m.dataFile, data, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to save instances: %v\n", err)
	}
}

func (m *Manager) List() []*Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		result = append(result, inst)
	}

	// Sort by name for consistent ordering
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name < result[j].Name
	})

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

	existing, ok := m.instances[inst.ID]
	if !ok {
		return fmt.Errorf("instance not found")
	}

	// Preserve runtime-only fields so editing a running instance does not lose
	// the active process handle and log association.
	inst.PID = existing.PID
	inst.LogFile = existing.LogFile
	if inst.Status == "" {
		inst.Status = existing.Status
	}
	if inst.Port == 0 {
		inst.Port = existing.Port
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

	// 使用配置的llama-server路径
	llamaBin := m.cfg.Paths.LlamaBin
	if llamaBin == "" {
		return fmt.Errorf("llama.cpp binary not configured in settings")
	}

	// 构建命令行参数
	args := []string{}

	// 添加模型参数
	if inst.Model != "" {
		args = append(args, "-m", inst.Model)
	}

	// 添加mmproj参数
	if inst.Mmproj != "" {
		args = append(args, "--mmproj", inst.Mmproj)
	}

	// 添加其他参数
	port := inst.Port
	if port <= 0 {
		// 尝试从params中获取端口
		if p, ok := inst.Params["port"].(float64); ok {
			port = int(p)
		}
	}
	if port <= 0 {
		port = 5000
	}
	args = append(args, "--port", fmt.Sprintf("%d", port))

	if host, ok := inst.Params["host"].(string); ok && host != "" {
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
		args = append(args, "--flash-attn", "on")
	}

	if mlock, ok := inst.Params["mlock"].(bool); ok && mlock {
		args = append(args, "-mlock")
	}

	if noMap, ok := inst.Params["no-mmap"].(bool); ok && noMap {
		args = append(args, "--no-mmap")
	}

	if batchSize, ok := inst.Params["batch_size"].(float64); ok && batchSize > 0 {
		args = append(args, "-b", fmt.Sprintf("%d", int(batchSize)))
	}

	// 添加提示词模板参数 (仅当不为空时，且服务器版本支持)
	// 注意: llama.cpp server 模式不支持 -sys 参数
	// if inst.PromptTemplate != "" {
	// 	args = append(args, "-sys", inst.PromptTemplate)
	// }

	// 创建日志文件
	logFile := filepath.Join(m.cfg.LogDir, fmt.Sprintf("%s.log", inst.ID))
	inst.LogFile = logFile

	// 打开日志文件
	lf, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		inst.Status = "error"
		m.saveInstances()
		return fmt.Errorf("failed to open log file: %w", err)
	}

	// 创建命令，使用管道捕获输出
	cmd := exec.Command(llamaBin, args...)

	// 创建管道
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		lf.Close()
		inst.Status = "error"
		m.saveInstances()
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	cmd.Stderr = lf

	// 启动进程
	if err := cmd.Start(); err != nil {
		lf.Close()
		stdoutPipe.Close()
		inst.Status = "error"
		m.saveInstances()
		return fmt.Errorf("failed to start llama-server: %w", err)
	}

	inst.PID = cmd.Process.Pid
	inst.Status = "running"

	m.mu.Lock()
	m.instances[inst.ID] = inst
	m.mu.Unlock()

	// 启动 goroutine 解析输出并写入日志文件
	go m.parseOutput(inst.ID, stdoutPipe, lf)

	// 等待服务真正启动
	time.Sleep(2 * time.Second)

	// 检查进程是否还在运行
	if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
		inst.Status = "error"
		m.saveInstances()
		return fmt.Errorf("llama-server exited unexpectedly")
	}

	m.saveInstances()
	return nil
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
	m.mu.Lock()
	defer m.mu.Unlock()

	binaryName := "llama-server"
	if m.cfg.Paths.LlamaBin != "" {
		binaryName = filepath.Base(m.cfg.Paths.LlamaBin)
	}

	// First kill all tracked instances.
	for _, inst := range m.instances {
		if inst.PID > 0 {
			log.Printf("StopAll: killing PID %d (%s)", inst.PID, inst.Name)
			err := killPID(inst.PID)
			if err != nil {
				log.Printf("StopAll: kill failed for PID %d: %v", inst.PID, err)
			}
			inst.Status = "stopped"
			inst.PID = 0
		}
	}

	// Also kill any orphaned llama-server processes left outside our tracked
	// instance list. We avoid shell wrappers here so the Linux path is explicit
	// and easier to reason about.
	log.Printf("StopAll: scanning for orphaned %s processes", binaryName)
	output, err := exec.Command("pgrep", "-x", binaryName).Output()
	if err == nil {
		for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
			if line == "" {
				continue
			}
			pid, convErr := strconv.Atoi(strings.TrimSpace(line))
			if convErr != nil || pid <= 0 {
				continue
			}
			if killErr := killPID(pid); killErr != nil {
				log.Printf("StopAll: failed to kill orphan PID %d: %v", pid, killErr)
			}
		}
	} else {
		log.Printf("StopAll: pgrep returned: %v", err)
	}

	m.saveInstances()
}

func (m *Manager) WatchStatus(wsMgr *websocket.Manager, logMgr *logs.Manager) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	// 创建带超时的HTTP客户端
	httpClient := &http.Client{
		Timeout: 2 * time.Second,
	}

	for range ticker.C {
		m.mu.Lock()
		for _, inst := range m.instances {
			// 检查运行中或加载中的实例
			if (inst.Status == "running" || inst.Status == "loading") && inst.PID > 0 {
				// 检查进程是否存在 - 使用 signal 0 来检测
				proc, err := os.FindProcess(inst.PID)
				if err != nil || proc.Pid < 0 {
					// 进程不存在，获取错误日志
					errMsg := extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
					inst.Status = "error"
					inst.PID = 0
					wsMgr.BroadcastInstanceStatus(inst.ID, "error")
					if errMsg != "" {
						wsMgr.BroadcastInstanceError(inst.ID, errMsg)
					}
					m.saveInstances()
					continue
				}

				// 获取端口
				port := inst.Port
				if port <= 0 {
					if p, ok := inst.Params["port"].(float64); ok {
						port = int(p)
					}
				}
				if port <= 0 {
					port = 5000
				}

				// 检查服务器是否在响应
				url := fmt.Sprintf("http://127.0.0.1:%d/health", port)
				resp, err := httpClient.Get(url)
				if err != nil {
					// 服务器未响应，检查是否是错误状态
					errMsg := extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
					// 检查日志中是否有关键错误信息
					lowerErr := strings.ToLower(errMsg)
					if strings.Contains(lowerErr, "failed") ||
						strings.Contains(lowerErr, "error") ||
						strings.Contains(lowerErr, "out of memory") ||
						strings.Contains(lowerErr, "cuda") ||
						strings.Contains(lowerErr, "abort") ||
						strings.Contains(lowerErr, "cannot") {
						// 真正的错误
						inst.Status = "error"
						inst.PID = 0
						wsMgr.BroadcastInstanceStatus(inst.ID, "error")
						if errMsg != "" {
							wsMgr.BroadcastInstanceError(inst.ID, errMsg)
						}
						m.saveInstances()
						continue
					}
					// 否则可能是加载中
					if inst.Status != "loading" {
						inst.Status = "loading"
						wsMgr.BroadcastInstanceStatus(inst.ID, "loading")
						m.saveInstances()
					}
					continue
				}
				resp.Body.Close()

				if resp.StatusCode == 200 {
					// 服务器已就绪
					if inst.Status != "running" {
						inst.Status = "running"
						wsMgr.BroadcastInstanceStatus(inst.ID, "running")
						m.saveInstances()
					}
				} else if resp.StatusCode == 503 {
					// 503 可能是加载中，需要检查日志判断是真正错误还是加载中
					errMsg := extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
					if strings.Contains(strings.ToLower(errMsg), "error") || strings.Contains(strings.ToLower(errMsg), "failed") || strings.Contains(strings.ToLower(errMsg), "panic") {
						// 真正的错误
						inst.Status = "error"
						inst.PID = 0
						wsMgr.BroadcastInstanceStatus(inst.ID, "error")
						wsMgr.BroadcastInstanceError(inst.ID, errMsg)
						m.saveInstances()
					} else {
						// 加载中
						if inst.Status != "loading" {
							inst.Status = "loading"
							wsMgr.BroadcastInstanceStatus(inst.ID, "loading")
							m.saveInstances()
						}
					}
				} else {
					// 其他错误码视为错误
					errMsg := extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
					inst.Status = "error"
					inst.PID = 0
					wsMgr.BroadcastInstanceStatus(inst.ID, "error")
					if errMsg != "" {
						wsMgr.BroadcastInstanceError(inst.ID, errMsg)
					}
					m.saveInstances()
				}
			}
		}
		m.mu.Unlock()
	}
}

// parseOutput 解析llama-server输出并实时推送状态
func (m *Manager) parseOutput(instanceID string, stdout io.ReadCloser, logFile *os.File) {
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()

		// 写入日志文件
		logFile.WriteString(line + "\n")
		logFile.Sync()

		// 解析进度信息并推送
		progress, msg := m.parseLine(line)
		if (progress != "" || msg != "") && m.wsManager != nil {
			m.wsManager.BroadcastInstanceProgress(instanceID, progress, msg)
		}

		// 推送日志行
		if m.wsManager != nil {
			m.wsManager.BroadcastLog(instanceID, line)
		}
	}

	logFile.Close()
	stdout.Close()

	// 检查进程是否退出
	m.mu.Lock()
	if inst, ok := m.instances[instanceID]; ok && inst.Status == "running" {
		inst.Status = "stopped"
		m.saveInstances()
		if m.wsManager != nil {
			m.wsManager.BroadcastInstanceStatus(instanceID, "stopped")
		}
	}
	m.mu.Unlock()
}

// parseLine 解析单行输出，返回状态信息
func (m *Manager) parseLine(line string) (string, string) {
	lower := strings.ToLower(line)

	// 模型加载相关
	if strings.Contains(lower, "loading model") {
		return "loading", "Loading model..."
	}
	if strings.Contains(lower, "loading model tensors") {
		return "loading_tensors", "Loading model tensors..."
	}
	if strings.Contains(lower, "offloading") {
		return "offloading", "Offloading layers to GPU..."
	}
	if strings.Contains(lower, "offloaded") {
		return "offloaded", "Layers offloaded to GPU"
	}
	if strings.Contains(lower, "model buffer") {
		return "loading", "Loading model buffer..."
	}

	// 初始化相关
	if strings.Contains(lower, "initializing slots") {
		return "initializing", "Initializing slots..."
	}
	if strings.Contains(lower, "slots are idle") {
		return "ready", "Ready"
	}

	// 错误相关 - 多种错误模式
	if strings.Contains(lower, "failed to load") ||
		strings.Contains(lower, "failed to initialize") ||
		strings.Contains(lower, "failed to create") ||
		strings.Contains(lower, "exiting due to") ||
		strings.Contains(lower, "out of memory") ||
		strings.Contains(lower, "cuda") && strings.Contains(lower, "failed") ||
		strings.Contains(lower, "cannot meet") {
		return "error", "Error: " + extractBriefMessage(line)
	}

	// 一般错误
	if strings.Contains(lower, "error") || strings.Contains(lower, "failed") {
		return "error", "Error occurred"
	}

	// 就绪信号 - 关键！
	if strings.Contains(lower, "model loaded") {
		return "ready", "Model loaded successfully"
	}
	if strings.Contains(lower, "server started") || strings.Contains(lower, "listening on") {
		return "ready", "Server ready"
	}

	return "", ""
}

// extractBriefMessage 提取简短的错误信息
func extractBriefMessage(line string) string {
	// 截取关键部分
	if len(line) > 80 {
		return line[:80] + "..."
	}
	return line
}

// extractErrorMessage 从日志中提取错误信息
func extractErrorMessage(logContent string) string {
	if logContent == "" {
		return ""
	}
	lines := strings.Split(logContent, "\n")
	// 从后往前找错误
	for i := len(lines) - 1; i >= 0; i-- {
		line := lines[i]
		lower := strings.ToLower(line)
		// 关键错误模式
		if strings.Contains(lower, "failed to") ||
			strings.Contains(lower, "failed") && strings.Contains(lower, "error") ||
			strings.Contains(lower, "exiting due to") ||
			strings.Contains(lower, "out of memory") ||
			strings.Contains(lower, "cannot meet") ||
			strings.Contains(lower, "panic") ||
			strings.Contains(lower, "abort") {
			return line
		}
	}
	// 如果没找到错误，返回最后一行
	if len(lines) > 0 && lines[len(lines)-1] != "" {
		return lines[len(lines)-1]
	}
	return ""
}

func killPID(pid int) error {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return err
	}
	return proc.Kill()
}
