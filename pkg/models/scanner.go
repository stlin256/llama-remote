package models

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type ModelInfo struct {
	Name         string `json:"name"`
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	ModifiedTime int64  `json:"modified_time"`
	Mmproj       string `json:"mmproj,omitempty"`
}

type Scanner struct {
	modelsDir string
}

func NewScanner(modelsDir string) *Scanner {
	return &Scanner{modelsDir: modelsDir}
}

func (s *Scanner) HandleScan() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		models, err := s.scanModels()
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"models": models})
	}
}

func (s *Scanner) scanModels() ([]ModelInfo, error) {
	var models []ModelInfo

	if _, err := os.Stat(s.modelsDir); os.IsNotExist(err) {
		return models, nil
	}

	// 再扫描所有gguf模型文件
	filepath.Walk(s.modelsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// 只处理.gguf文件，排除文件名包含mmproj的
		if strings.HasSuffix(strings.ToLower(info.Name()), ".gguf") && !strings.Contains(strings.ToLower(info.Name()), "mmproj") {
			model := ModelInfo{
				Name:         info.Name(),
				Path:         path,
				Size:         info.Size(),
				ModifiedTime: info.ModTime().Unix(),
			}

			// 检查同目录下是否有mmproj文件（模糊匹配）
			dir := filepath.Dir(path)
			entries, err := os.ReadDir(dir)
			if err == nil {
				var mmprojs []string
				for _, entry := range entries {
					if entry.IsDir() {
						continue
					}
					name := entry.Name()
					// 只要文件名包含mmproj且是gguf文件就匹配
					if strings.HasSuffix(strings.ToLower(name), ".gguf") &&
						strings.Contains(strings.ToLower(name), "mmproj") &&
						name != info.Name() { // 排除自身
						mmprojs = append(mmprojs, filepath.Join(dir, name))
					}
				}
				if len(mmprojs) > 0 {
					model.Mmproj = strings.Join(mmprojs, ",")
				}
			}

			models = append(models, model)
		}

		return nil
	})

	// 按大小排序
	for i := 0; i < len(models)-1; i++ {
		for j := i + 1; j < len(models); j++ {
			if models[j].Size > models[i].Size {
				models[i], models[j] = models[j], models[i]
			}
		}
	}

	return models, nil
}

func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %s", float64(bytes)/float64(div), []string{"KB", "MB", "GB", "TB"}[exp])
}

func init() {
	_ = time.Now()
}
