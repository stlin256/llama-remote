package templates

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Template struct {
	Name   string                 `yaml:"name"`
	Params map[string]interface{} `yaml:"params"`
}

type Manager struct {
	dataDir string
}

func NewManager(dataDir string) *Manager {
	return &Manager{dataDir: dataDir}
}

func (m *Manager) filePath() string {
	return filepath.Join(m.dataDir, "templates.yaml")
}

func (m *Manager) load() ([]Template, error) {
	var templates []Template

	path := m.filePath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return templates, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	if err := yaml.Unmarshal(data, &templates); err != nil {
		return nil, err
	}

	return templates, nil
}

func (m *Manager) save(templates []Template) error {
	data, err := yaml.Marshal(templates)
	if err != nil {
		return err
	}

	return os.WriteFile(m.filePath(), data, 0644)
}

func (m *Manager) HandleList() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		templates, err := m.load()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"templates": templates})
	}
}

func (m *Manager) HandleSave() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var template Template
		if err := json.NewDecoder(r.Body).Decode(&template); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		templates, err := m.load()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		// 更新或添加
		found := false
		for i, t := range templates {
			if t.Name == template.Name {
				templates[i] = template
				found = true
				break
			}
		}
		if !found {
			templates = append(templates, template)
		}

		if err := m.save(templates); err != nil {
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

		templates, err := m.load()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		for i, t := range templates {
			if t.Name == name {
				templates = append(templates[:i], templates[i+1:]...)
				break
			}
		}

		if err := m.save(templates); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func init() {
	_ = fmt.Sprintf("")
}
