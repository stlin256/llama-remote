package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Paths    PathsConfig    `yaml:"paths"`
	DataDir  string         `yaml:"-"`
	LogDir   string         `yaml:"-"`
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type PathsConfig struct {
	LlamaBin string `yaml:"llama_bin"`
	ModelsDir string `yaml:"models_dir"`
}

func DefaultConfig() *Config {
	homeDir, _ := os.UserHomeDir()
	dataDir := filepath.Join(homeDir, ".llama-remote")

	return &Config{
		Server: ServerConfig{
			Host: "0.0.0.0",
			Port: 8080,
		},
		Paths: PathsConfig{
			LlamaBin: "",
			ModelsDir: filepath.Join(homeDir, "models"),
		},
		DataDir: dataDir,
		LogDir:  filepath.Join(dataDir, "logs"),
	}
}

func (c *Config) EnsureDataDir() error {
	dirs := []string{c.DataDir, c.LogDir}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}
	return nil
}

func (c *Config) Save() error {
	configPath := filepath.Join(c.DataDir, "config.yaml")
	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	return os.WriteFile(configPath, data, 0644)
}

func Load() (*Config, error) {
	cfg := DefaultConfig()
	configPath := filepath.Join(cfg.DataDir, "config.yaml")

	// 如果配置文件存在，加载它
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, fmt.Errorf("failed to parse config: %w", err)
		}
	}

	// 确保目录存在
	if err := cfg.EnsureDataDir(); err != nil {
		return nil, err
	}

	return cfg, nil
}
