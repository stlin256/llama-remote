package prompts

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type PromptTemplate struct {
	Name        string              `yaml:"name"`
	Content     string              `yaml:"content"`
	Variables   []PromptVariable    `yaml:"variables,omitempty"`
}

type PromptVariable struct {
	Name    string `yaml:"name"`
	Default string `yaml:"default"`
}

type Manager struct {
	dataDir string
}

func NewManager(dataDir string) *Manager {
	return &Manager{dataDir: dataDir}
}

func (m *Manager) filePath() string {
	return filepath.Join(m.dataDir, "prompts.yaml")
}

func (m *Manager) load() ([]PromptTemplate, error) {
	var prompts []PromptTemplate

	path := m.filePath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return prompts, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	if err := yaml.Unmarshal(data, &prompts); err != nil {
		return nil, err
	}

	return prompts, nil
}

func (m *Manager) save(prompts []PromptTemplate) error {
	data, err := yaml.Marshal(prompts)
	if err != nil {
		return err
	}

	return os.WriteFile(m.filePath(), data, 0644)
}

func (m *Manager) HandleList() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		prompts, err := m.load()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"prompts": prompts})
	}
}

func (m *Manager) HandleSave() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var prompt PromptTemplate
		if err := json.NewDecoder(r.Body).Decode(&prompt); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		prompts, err := m.load()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// 更新或添加
		found := false
		for i, p := range prompts {
			if p.Name == prompt.Name {
				prompts[i] = prompt
				found = true
				break
			}
		}
		if !found {
			prompts = append(prompts, prompt)
		}

		if err := m.save(prompts); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func (m *Manager) HandleDelete() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name := r.URL.Query().Get("name")
		if name == "" {
			http.Error(w, "name required", 400)
			return
		}

		prompts, err := m.load()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		for i, p := range prompts {
			if p.Name == name {
				prompts = append(prompts[:i], prompts[i+1:]...)
				break
			}
		}

		if err := m.save(prompts); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
