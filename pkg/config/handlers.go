package config

import (
	"encoding/json"
	"net/http"
)

type ConfigResponse struct {
	Server struct {
		Host string `json:"host"`
		Port int    `json:"port"`
	} `json:"server"`
	Paths struct {
		LlamaBin  string `json:"llama_bin"`
		ModelsDir string `json:"models_dir"`
		LogDir    string `json:"log_dir"`
	} `json:"paths"`
	Auth struct {
		Enable bool `json:"enable"`
	} `json:"auth"`
}

func HandleGet(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		resp := ConfigResponse{}
		resp.Server.Host = cfg.Server.Host
		resp.Server.Port = cfg.Server.Port
		resp.Paths.LlamaBin = cfg.Paths.LlamaBin
		resp.Paths.ModelsDir = cfg.Paths.ModelsDir
		resp.Paths.LogDir = cfg.LogDir
		resp.Auth.Enable = cfg.Auth.Enable

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}

type UpdateRequest struct {
	Server struct {
		Host string `json:"host"`
		Port int    `json:"port"`
	} `json:"server"`
	Paths struct {
		LlamaBin  string `json:"llama_bin"`
		ModelsDir string `json:"models_dir"`
	} `json:"paths"`
	Auth struct {
		Enable   *bool  `json:"enable"`
		Password string `json:"password"`
	} `json:"auth"`
}

func HandleUpdate(cfg *Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req UpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}

		if req.Server.Host != "" {
			cfg.Server.Host = req.Server.Host
		}
		if req.Server.Port > 0 {
			cfg.Server.Port = req.Server.Port
		}
		if req.Paths.LlamaBin != "" {
			cfg.Paths.LlamaBin = req.Paths.LlamaBin
		}
		if req.Paths.ModelsDir != "" {
			cfg.Paths.ModelsDir = req.Paths.ModelsDir
		}
		if req.Auth.Enable != nil {
			cfg.Auth.Enable = *req.Auth.Enable
		}
		if req.Auth.Password != "" {
			cfg.Auth.Password = req.Auth.Password
		}

		if err := cfg.Save(); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
