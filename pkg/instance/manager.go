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
	cfg         *config.Config
	instances   map[string]*Instance
	processes   map[string]*exec.Cmd
	startTokens map[string]uint64
	nextStart   uint64
	mu          sync.RWMutex
	logManager  *logs.Manager
	wsManager   *websocket.Manager
	dataFile    string
}

func NewManager(cfg *config.Config, logManager *logs.Manager, wsManager *websocket.Manager) *Manager {
	m := &Manager{
		cfg:         cfg,
		instances:   make(map[string]*Instance),
		processes:   make(map[string]*exec.Cmd),
		startTokens: make(map[string]uint64),
		logManager:  logManager,
		wsManager:   wsManager,
		dataFile:    filepath.Join(cfg.DataDir, "instances.yaml"),
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
	m.mu.RLock()
	instanceData := m.instanceDataLocked()
	m.mu.RUnlock()
	m.writeInstances(instanceData)
}

func (m *Manager) saveInstancesLocked() {
	m.writeInstances(m.instanceDataLocked())
}

func (m *Manager) instanceDataLocked() InstanceData {
	instanceData := InstanceData{
		Instances: make([]Instance, 0, len(m.instances)),
	}

	for _, inst := range m.instances {
		instanceData.Instances = append(instanceData.Instances, *inst)
	}
	sort.Slice(instanceData.Instances, func(i, j int) bool {
		return instanceData.Instances[i].Name < instanceData.Instances[j].Name
	})
	return instanceData
}

func (m *Manager) writeInstances(instanceData InstanceData) {
	data, err := yaml.Marshal(instanceData)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal instances: %v\n", err)
		return
	}

	tmpFile := m.dataFile + ".tmp"
	if err := os.WriteFile(tmpFile, data, 0600); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to save instances: %v\n", err)
		return
	}
	if err := os.Rename(tmpFile, m.dataFile); err != nil {
		_ = os.Remove(tmpFile)
		fmt.Fprintf(os.Stderr, "Failed to save instances: %v\n", err)
	}
}

func (m *Manager) List() []*Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		cloned := cloneInstance(inst)
		result = append(result, &cloned)
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
	if !ok {
		return nil, false
	}
	cloned := cloneInstance(inst)
	return &cloned, true
}

func cloneInstance(inst *Instance) Instance {
	cloned := *inst
	if inst.Params != nil {
		cloned.Params = make(map[string]interface{}, len(inst.Params))
		for key, value := range inst.Params {
			cloned.Params[key] = value
		}
	}
	return cloned
}

func instancePort(inst Instance) int {
	port := inst.Port
	if port <= 0 && inst.Params != nil {
		if p, ok := intParam(inst.Params, "port"); ok {
			port = p
		}
	}
	if port <= 0 {
		port = 5000
	}
	return port
}

func intParam(params map[string]interface{}, key string) (int, bool) {
	if params == nil {
		return 0, false
	}
	switch value := params[key].(type) {
	case int:
		return value, true
	case int32:
		return int(value), true
	case int64:
		return int(value), true
	case uint:
		return int(value), true
	case uint32:
		return int(value), true
	case uint64:
		return int(value), true
	case float32:
		return int(value), true
	case float64:
		return int(value), true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		return parsed, err == nil
	default:
		return 0, false
	}
}

func buildLlamaArgs(inst Instance, port int) []string {
	args := []string{}

	if inst.Model != "" {
		args = append(args, "-m", inst.Model)
	}
	if inst.Mmproj != "" {
		args = append(args, "--mmproj", inst.Mmproj)
	}

	args = append(args, "--port", fmt.Sprintf("%d", port))
	if host, ok := inst.Params["host"].(string); ok && host != "" {
		args = append(args, "--host", host)
	} else {
		args = append(args, "--host", "127.0.0.1")
	}

	if ngl, ok := intParam(inst.Params, "ngl"); ok {
		args = append(args, "-ngl", fmt.Sprintf("%d", ngl))
	}
	if context, ok := intParam(inst.Params, "context"); ok {
		args = append(args, "-c", fmt.Sprintf("%d", context))
	}
	if threads, ok := intParam(inst.Params, "threads"); ok {
		args = append(args, "-t", fmt.Sprintf("%d", threads))
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
	if batchSize, ok := intParam(inst.Params, "batch_size"); ok && batchSize > 0 {
		args = append(args, "-b", fmt.Sprintf("%d", batchSize))
	}

	return args
}

func isActiveStatus(status string) bool {
	return status == "starting" || status == "loading" || status == "running"
}

func (m *Manager) setInstanceState(id, status string, pid int, removeProcess bool) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	inst, ok := m.instances[id]
	if !ok {
		return false
	}
	changed := false
	if status != "" {
		if inst.Status != status {
			inst.Status = status
			changed = true
		}
	}
	if pid >= 0 {
		if inst.PID != pid {
			inst.PID = pid
			changed = true
		}
	}
	if removeProcess {
		if _, ok := m.processes[id]; ok {
			delete(m.processes, id)
			changed = true
		}
	}
	if changed {
		m.saveInstancesLocked()
	}
	return changed
}

func (m *Manager) snapshotInstances() []Instance {
	m.mu.RLock()
	defer m.mu.RUnlock()
	instances := make([]Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		instances = append(instances, cloneInstance(inst))
	}
	return instances
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
	m.saveInstancesLocked()
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
	m.saveInstancesLocked()
	return nil
}

func (m *Manager) Delete(id string) error {
	m.mu.Lock()
	inst, ok := m.instances[id]
	if !ok {
		m.mu.Unlock()
		return nil
	}
	cmd := m.processes[id]
	pid := inst.PID
	delete(m.instances, id)
	delete(m.processes, id)
	delete(m.startTokens, id)
	m.saveInstancesLocked()
	m.mu.Unlock()

	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	} else if pid > 0 {
		_ = killPID(pid)
	}
	return nil
}

func (m *Manager) Start(id string) error {
	m.mu.Lock()
	inst, ok := m.instances[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("instance not found")
	}
	if isActiveStatus(inst.Status) {
		status := inst.Status
		m.mu.Unlock()
		return fmt.Errorf("instance already %s", status)
	}

	instSnapshot := cloneInstance(inst)
	port := instancePort(instSnapshot)
	logFile := filepath.Join(m.cfg.LogDir, fmt.Sprintf("%s.log", instSnapshot.ID))

	m.nextStart++
	startToken := m.nextStart
	m.startTokens[id] = startToken
	inst.Status = "starting"
	inst.PID = 0
	inst.Port = port
	inst.LogFile = logFile
	m.saveInstancesLocked()
	m.mu.Unlock()

	if m.wsManager != nil {
		m.wsManager.BroadcastInstanceStatus(id, "starting")
	}

	llamaBin := strings.TrimSpace(m.cfg.Paths.LlamaBin)
	if llamaBin == "" {
		return m.failInstanceStart(id, startToken, fmt.Errorf("llama.cpp binary not configured in settings"))
	}

	args := buildLlamaArgs(instSnapshot, port)
	lf, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return m.failInstanceStart(id, startToken, fmt.Errorf("failed to open log file: %w", err))
	}

	cmd := exec.Command(llamaBin, args...)
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		_ = lf.Close()
		return m.failInstanceStart(id, startToken, fmt.Errorf("failed to create stdout pipe: %w", err))
	}
	cmd.Stderr = lf

	if err := cmd.Start(); err != nil {
		_ = lf.Close()
		_ = stdoutPipe.Close()
		return m.failInstanceStart(id, startToken, fmt.Errorf("failed to start llama-server: %w", err))
	}

	m.mu.Lock()
	current, ok := m.instances[id]
	tokenMatches := m.startTokens[id] == startToken
	if !ok || !tokenMatches || !isActiveStatus(current.Status) {
		m.mu.Unlock()
		_ = cmd.Process.Kill()
		go reapProcess(cmd, stdoutPipe, lf)
		return fmt.Errorf("instance start cancelled")
	}
	delete(m.startTokens, id)
	current.PID = cmd.Process.Pid
	current.Status = "loading"
	current.Port = port
	current.LogFile = logFile
	m.processes[id] = cmd
	m.saveInstancesLocked()
	m.mu.Unlock()

	go m.monitorProcess(id, cmd, stdoutPipe, lf)

	if m.wsManager != nil {
		m.wsManager.BroadcastInstanceStatus(id, "loading")
	}
	return nil
}

func (m *Manager) Stop(id string) error {
	m.mu.Lock()
	inst, ok := m.instances[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("instance not found")
	}
	cmd := m.processes[id]
	pid := inst.PID
	delete(m.startTokens, id)
	inst.Status = "stopped"
	inst.PID = 0
	m.saveInstancesLocked()
	m.mu.Unlock()

	if m.wsManager != nil {
		m.wsManager.BroadcastInstanceStatus(id, "stopped")
	}
	if cmd != nil && cmd.Process != nil {
		if err := cmd.Process.Kill(); err != nil {
			log.Printf("Stop: kill failed for instance %s: %v", id, err)
		}
	} else if pid > 0 {
		if err := killPID(pid); err != nil {
			log.Printf("Stop: kill failed for PID %d: %v", pid, err)
		}
	}
	return nil
}

func (m *Manager) failInstanceStart(id string, startToken uint64, startErr error) error {
	shouldBroadcast := false

	m.mu.Lock()
	if inst, ok := m.instances[id]; ok && m.startTokens[id] == startToken {
		delete(m.startTokens, id)
		inst.Status = "error"
		inst.PID = 0
		m.saveInstancesLocked()
		shouldBroadcast = true
	}
	m.mu.Unlock()

	if shouldBroadcast && m.wsManager != nil {
		m.wsManager.BroadcastInstanceStatus(id, "error")
		m.wsManager.BroadcastInstanceError(id, startErr.Error())
	}
	return startErr
}

func reapProcess(cmd *exec.Cmd, stdout io.ReadCloser, logFile *os.File) {
	_, _ = io.Copy(io.Discard, stdout)
	_ = stdout.Close()
	_ = cmd.Wait()
	_ = logFile.Close()
}

func (m *Manager) monitorProcess(instanceID string, cmd *exec.Cmd, stdout io.ReadCloser, logFile *os.File) {
	m.parseOutput(instanceID, stdout, logFile)
	err := cmd.Wait()
	_ = logFile.Close()
	m.finishProcess(instanceID, cmd, err)
}

func (m *Manager) finishProcess(instanceID string, cmd *exec.Cmd, err error) {
	nextStatus := ""

	m.mu.Lock()
	currentCmd, tracked := m.processes[instanceID]
	if !tracked || currentCmd != cmd {
		m.mu.Unlock()
		return
	}
	delete(m.processes, instanceID)

	if inst, ok := m.instances[instanceID]; ok {
		inst.PID = 0
		if isActiveStatus(inst.Status) {
			if err != nil {
				inst.Status = "error"
				nextStatus = "error"
			} else {
				inst.Status = "stopped"
				nextStatus = "stopped"
			}
		}
		m.saveInstancesLocked()
	}
	m.mu.Unlock()

	if nextStatus != "" && m.wsManager != nil {
		m.wsManager.BroadcastInstanceStatus(instanceID, nextStatus)
		if nextStatus == "error" {
			errMsg := ""
			if m.logManager != nil {
				errMsg = extractErrorMessage(m.logManager.GetRecentLogs(instanceID, 50))
			}
			if errMsg == "" && err != nil {
				errMsg = err.Error()
			}
			if errMsg != "" {
				m.wsManager.BroadcastInstanceError(instanceID, errMsg)
			}
		}
	}
}

func (m *Manager) StopAll() {
	type processRef struct {
		id   string
		name string
		cmd  *exec.Cmd
		pid  int
	}

	refs := []processRef{}
	m.mu.Lock()
	for id, inst := range m.instances {
		if inst.PID > 0 || isActiveStatus(inst.Status) {
			refs = append(refs, processRef{
				id:   id,
				name: inst.Name,
				cmd:  m.processes[id],
				pid:  inst.PID,
			})
			inst.Status = "stopped"
			inst.PID = 0
		}
		delete(m.startTokens, id)
	}
	m.saveInstancesLocked()
	m.mu.Unlock()

	for _, ref := range refs {
		if m.wsManager != nil {
			m.wsManager.BroadcastInstanceStatus(ref.id, "stopped")
		}
		if ref.cmd != nil && ref.cmd.Process != nil {
			log.Printf("StopAll: killing PID %d (%s)", ref.cmd.Process.Pid, ref.name)
			if err := ref.cmd.Process.Kill(); err != nil {
				log.Printf("StopAll: kill failed for PID %d: %v", ref.cmd.Process.Pid, err)
			}
			continue
		}
		if ref.pid > 0 {
			log.Printf("StopAll: killing PID %d (%s)", ref.pid, ref.name)
			if err := killPID(ref.pid); err != nil {
				log.Printf("StopAll: kill failed for PID %d: %v", ref.pid, err)
			}
		}
	}

	binaryName := "llama-server"
	if m.cfg.Paths.LlamaBin != "" {
		binaryName = filepath.Base(m.cfg.Paths.LlamaBin)
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
}

func (m *Manager) WatchStatus(wsMgr *websocket.Manager, logMgr *logs.Manager) {
	if wsMgr == nil {
		wsMgr = m.wsManager
	}
	if logMgr == nil {
		logMgr = m.logManager
	}

	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	httpClient := &http.Client{
		Timeout: 2 * time.Second,
	}

	for range ticker.C {
		for _, inst := range m.snapshotInstances() {
			if !isActiveStatus(inst.Status) || inst.PID <= 0 {
				continue
			}

			status := ""
			pid := -1
			errMsg := ""
			url := fmt.Sprintf("http://127.0.0.1:%d/health", instancePort(inst))

			resp, err := httpClient.Get(url)
			if err != nil {
				if logMgr != nil {
					errMsg = extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
				}
				if isFatalLogMessage(errMsg) {
					status = "error"
					pid = 0
				} else {
					status = "loading"
				}
			} else {
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()

				switch resp.StatusCode {
				case http.StatusOK:
					status = "running"
				case http.StatusServiceUnavailable:
					if logMgr != nil {
						errMsg = extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
					}
					if isFatalLogMessage(errMsg) {
						status = "error"
						pid = 0
					} else {
						status = "loading"
					}
				default:
					if logMgr != nil {
						errMsg = extractErrorMessage(logMgr.GetRecentLogs(inst.ID, 50))
					}
					status = "error"
					pid = 0
				}
			}

			if status == "" {
				continue
			}
			if m.setInstanceState(inst.ID, status, pid, false) && wsMgr != nil {
				wsMgr.BroadcastInstanceStatus(inst.ID, status)
				if status == "error" && errMsg != "" {
					wsMgr.BroadcastInstanceError(inst.ID, errMsg)
				}
			}
		}
	}
}

func isFatalLogMessage(errMsg string) bool {
	lowerErr := strings.ToLower(errMsg)
	return strings.Contains(lowerErr, "failed") ||
		strings.Contains(lowerErr, "error") ||
		strings.Contains(lowerErr, "out of memory") ||
		strings.Contains(lowerErr, "cuda") ||
		strings.Contains(lowerErr, "abort") ||
		strings.Contains(lowerErr, "cannot") ||
		strings.Contains(lowerErr, "panic")
}

// parseOutput 解析llama-server输出并实时推送状态
func (m *Manager) parseOutput(instanceID string, stdout io.ReadCloser, logFile *os.File) {
	defer stdout.Close()

	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()

		// 写入日志文件
		_, _ = logFile.WriteString(line + "\n")
		_ = logFile.Sync()

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
