package instance

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

func (m *Manager) HandleList() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instances := m.List()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(instances)
	}
}

func (m *Manager) HandleCreate() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var inst Instance
		if err := json.NewDecoder(r.Body).Decode(&inst); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		if err := m.Create(&inst); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(inst)
	}
}

func (m *Manager) HandleGet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		inst, ok := m.Get(id)
		if !ok {
			http.Error(w, "instance not found", 404)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(inst)
	}
}

func (m *Manager) HandleUpdate() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		var inst Instance
		if err := json.NewDecoder(r.Body).Decode(&inst); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		inst.ID = id

		if err := m.Update(&inst); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(inst)
	}
}

func (m *Manager) HandleDelete() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		if err := m.Delete(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func (m *Manager) HandleStart() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		if err := m.Start(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func (m *Manager) HandleStop() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]

		if err := m.Stop(id); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
