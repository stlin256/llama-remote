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

	// 用于存储已找到的mmproj
	mmprojMap := make(map[string]string)

	// 先扫描所有mmproj文件
	filepath.Walk(s.modelsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if strings.HasSuffix(strings.ToLower(info.Name()), ".gguf") {
			if strings.Contains(info.Name(), "mmproj") {
				// 这是mmproj文件，找到对应的模型
				modelPath := strings.Replace(path, "mmproj-", "", 1)
				modelPath = strings.Replace(modelPath, ".gguf", ".gguf", 1)
				mmprojMap[modelPath] = path
			}
		}
		return nil
	})

	// 再扫描所有gguf模型文件
	filepath.Walk(s.modelsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		// 只处理.gguf文件，排除mmproj开头的
		if strings.HasSuffix(strings.ToLower(info.Name()), ".gguf") && !strings.HasPrefix(info.Name(), "mmproj") {
			model := ModelInfo{
				Name:         info.Name(),
				Path:         path,
				Size:         info.Size(),
				ModifiedTime: info.ModTime().Unix(),
			}

			// 检查是否有对应的mmproj
			if mmproj, ok := mmprojMap[path]; ok {
				model.Mmproj = mmproj
			}

			// 也检查同级目录下的mmproj文件
			if model.Mmproj == "" {
				dir := filepath.Dir(path)
				baseName := strings.TrimSuffix(info.Name(), ".gguf")
				possibleMmproj := filepath.Join(dir, "mmproj-"+baseName+".gguf")
				if _, err := os.Stat(possibleMmproj); err == nil {
					model.Mmproj = possibleMmproj
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
