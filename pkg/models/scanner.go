package models

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/llama-remote/server/pkg/models/gguf"
)

type ModelInfo struct {
	Name         string `json:"name"`
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	ModifiedTime int64  `json:"modified_time"`
	Mmproj       string `json:"mmproj,omitempty"`

	// GGUF metadata
	ModelName        string `json:"model_name,omitempty"`
	Architecture     string `json:"architecture,omitempty"`
	Quantization     string `json:"quantization,omitempty"`
	VocabularySize   int64  `json:"vocabulary_size,omitempty"`
	ContextLength    int64  `json:"context_length,omitempty"`
	EmbeddingLength  int64  `json:"embedding_length,omitempty"`
	BlockCount       int64  `json:"block_count,omitempty"`
	AttentionHeads   int64  `json:"attention_heads,omitempty"`
}

type Scanner struct {
	modelsDir string
	cached    []ModelInfo
	cacheTime time.Time
	cacheMu   sync.RWMutex
	scanDone  chan bool
}

func NewScanner(modelsDir string) *Scanner {
	s := &Scanner{
		modelsDir: modelsDir,
		scanDone:  make(chan bool, 1),
	}

	// 启动时立即扫描一次
	go func() {
		s.doScan()
		s.scanDone <- true
	}()

	// 后台每5分钟异步扫描
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.doScan()
			case <-s.scanDone:
				// 首次扫描完成
			}
		}
	}()

	// 等待首次扫描完成或超时
	select {
	case <-s.scanDone:
	case <-time.After(30 * time.Second):
	}

	return s
}

func (s *Scanner) HandleScan() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 返回缓存的数据
		s.cacheMu.RLock()
		models := s.cached
		cacheTime := s.cacheTime
		s.cacheMu.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Time", cacheTime.Format(time.RFC3339))
		json.NewEncoder(w).Encode(map[string]interface{}{"models": models})
	}
}

func (s *Scanner) doScan() {
	models, err := s.scanModels()
	if err != nil {
		fmt.Printf("Model scan error: %v\n", err)
		return
	}

	s.cacheMu.Lock()
	s.cached = models
	s.cacheTime = time.Now()
	s.cacheMu.Unlock()

	fmt.Printf("Model scan complete: %d models cached\n", len(models))
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

			// 尝试解析GGUF元数据
			if meta, err := gguf.GetModelInfo(path); err == nil {
				// 使用元数据中的名称，如果没有则使用文件名
				if meta.Name != "" {
					model.ModelName = meta.Name
				} else {
					model.ModelName = strings.TrimSuffix(info.Name(), ".gguf")
				}
				model.Architecture = meta.Architecture
				model.Quantization = meta.FileType
				model.VocabularySize = meta.VocabularySize
				model.ContextLength = meta.ContextLength
				model.EmbeddingLength = meta.EmbeddingLength
				model.BlockCount = meta.BlockCount
				model.AttentionHeads = meta.AttentionHeads
			} else {
				// 如果解析失败，使用文件名
				model.ModelName = strings.TrimSuffix(info.Name(), ".gguf")
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
