package instance

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/llama-remote/server/pkg/config"
)

func newTestManager(t *testing.T) *Manager {
	t.Helper()
	dataDir := t.TempDir()
	logDir := filepath.Join(dataDir, "logs")
	if err := os.MkdirAll(logDir, 0700); err != nil {
		t.Fatalf("mkdir logs: %v", err)
	}
	return NewManager(&config.Config{
		Paths:   config.PathsConfig{},
		DataDir: dataDir,
		LogDir:  logDir,
	}, nil, nil)
}

func TestBuildLlamaArgsAcceptsPersistedNumericTypes(t *testing.T) {
	inst := Instance{
		Model:  "model.gguf",
		Mmproj: "mmproj.gguf",
		Params: map[string]interface{}{
			"port":            "7001",
			"host":            "127.0.0.1",
			"ngl":             33,
			"context":         int64(4096),
			"threads":         float64(8),
			"batch_size":      "128",
			"flash_attention": true,
			"mlock":           true,
			"no-mmap":         true,
		},
	}

	port := instancePort(inst)
	if port != 7001 {
		t.Fatalf("instancePort() = %d, want 7001", port)
	}

	args := strings.Join(buildLlamaArgs(inst, port), " ")
	for _, want := range []string{
		"-m model.gguf",
		"--mmproj mmproj.gguf",
		"--port 7001",
		"--host 127.0.0.1",
		"-ngl 33",
		"-c 4096",
		"-t 8",
		"-b 128",
		"--flash-attn on",
		"-mlock",
		"--no-mmap",
	} {
		if !strings.Contains(args, want) {
			t.Fatalf("args %q missing %q", args, want)
		}
	}
}

func TestManagerReturnsInstanceCopies(t *testing.T) {
	m := newTestManager(t)
	if err := m.Create(&Instance{
		ID:     "one",
		Name:   "One",
		Status: "stopped",
		Params: map[string]interface{}{"port": 5001},
	}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	got, ok := m.Get("one")
	if !ok {
		t.Fatal("Get() returned missing instance")
	}
	got.Name = "mutated"
	got.Params["port"] = 9000

	again, ok := m.Get("one")
	if !ok {
		t.Fatal("second Get() returned missing instance")
	}
	if again.Name != "One" {
		t.Fatalf("Get() leaked internal name, got %q", again.Name)
	}
	if again.Params["port"] != 5001 {
		t.Fatalf("Get() leaked internal params, got %#v", again.Params["port"])
	}

	list := m.List()
	if len(list) != 1 {
		t.Fatalf("List() length = %d, want 1", len(list))
	}
	list[0].Name = "list mutated"

	again, _ = m.Get("one")
	if again.Name != "One" {
		t.Fatalf("List() leaked internal pointer, got %q", again.Name)
	}
}

func TestStartWithoutConfiguredBinaryMarksError(t *testing.T) {
	m := newTestManager(t)
	if err := m.Create(&Instance{
		ID:     "missing-bin",
		Name:   "Missing Bin",
		Status: "stopped",
		Params: map[string]interface{}{"port": 5001},
	}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	if err := m.Start("missing-bin"); err == nil {
		t.Fatal("Start() error = nil, want error")
	}

	got, ok := m.Get("missing-bin")
	if !ok {
		t.Fatal("Get() returned missing instance")
	}
	if got.Status != "error" {
		t.Fatalf("status = %q, want error", got.Status)
	}
	if got.PID != 0 {
		t.Fatalf("PID = %d, want 0", got.PID)
	}
}
