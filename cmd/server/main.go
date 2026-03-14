package main

import (
	"context"
	"embed"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/llama-remote/server/pkg/config"
	"github.com/llama-remote/server/pkg/gpu"
	"github.com/llama-remote/server/pkg/instance"
	"github.com/llama-remote/server/pkg/logs"
	"github.com/llama-remote/server/pkg/models"
	"github.com/llama-remote/server/pkg/prompts"
	"github.com/llama-remote/server/pkg/templates"
	"github.com/llama-remote/server/pkg/websocket"

	"github.com/gorilla/mux"
	"github.com/gorilla/handlers"
)

//go:embed dist
var assets embed.FS

func main() {
	// 加载配置
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 创建数据目录
	if err := cfg.EnsureDataDir(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create data directory: %v\n", err)
		os.Exit(1)
	}

	// 初始化日志管理器
	logManager := logs.NewManager(cfg.LogDir)
	defer logManager.Close()

	// 初始化实例管理器
	instanceMgr := instance.NewManager(cfg, logManager)
	defer instanceMgr.StopAll()

	// 初始化GPU监控
	gpuMonitor := gpu.NewMonitor()
	defer gpuMonitor.Stop()

	// 初始化模板管理器
	templateMgr := templates.NewManager(cfg.DataDir)
	promptMgr := prompts.NewManager(cfg.DataDir)

	// 初始化模型扫描器
	modelScanner := models.NewScanner(cfg.Paths.ModelsDir)

	// 初始化WebSocket管理器
	wsMgr := websocket.NewManager()

	// 启动GPU监控
	gpuMonitor.Start()
	go func() {
		for {
			select {
			case stats := <-gpuMonitor.Stats():
				wsMgr.BroadcastStats(stats)
			}
		}
	}()

	// 启动实例状态监控
	go instanceMgr.WatchStatus(wsMgr)

	// 创建HTTP路由
	r := mux.NewRouter()

	// API路由
	api := r.PathPrefix("/api").Subrouter()

	// 配置API
	api.HandleFunc("/config", config.HandleGet(cfg)).Methods("GET")
	api.HandleFunc("/config", config.HandleUpdate(cfg)).Methods("PUT")

	// 实例API
	api.HandleFunc("/instances", instanceMgr.HandleList()).Methods("GET")
	api.HandleFunc("/instances", instanceMgr.HandleCreate()).Methods("POST")
	api.HandleFunc("/instances/{id}", instanceMgr.HandleGet()).Methods("GET")
	api.HandleFunc("/instances/{id}", instanceMgr.HandleUpdate()).Methods("PUT")
	api.HandleFunc("/instances/{id}", instanceMgr.HandleDelete()).Methods("DELETE")
	api.HandleFunc("/instances/{id}/start", instanceMgr.HandleStart()).Methods("POST")
	api.HandleFunc("/instances/{id}/stop", instanceMgr.HandleStop()).Methods("POST")

	// 模型API
	api.HandleFunc("/models", modelScanner.HandleScan()).Methods("GET")

	// 模板API
	api.HandleFunc("/templates", templateMgr.HandleList()).Methods("GET")
	api.HandleFunc("/templates", templateMgr.HandleSave()).Methods("POST")
	api.HandleFunc("/templates/{name}", templateMgr.HandleDelete()).Methods("DELETE")

	// 提示词模板API
	api.HandleFunc("/prompts", promptMgr.HandleList()).Methods("GET")
	api.HandleFunc("/prompts", promptMgr.HandleSave()).Methods("POST")
	api.HandleFunc("/prompts/{name}", promptMgr.HandleDelete()).Methods("DELETE")

	// GPU状态API
	api.HandleFunc("/gpu", gpuMonitor.HandleGet()).Methods("GET")

	// 日志API
	api.HandleFunc("/logs", logManager.HandleGet()).Methods("GET")
	api.HandleFunc("/logs/stream", logManager.HandleStream(wsMgr)).Methods("GET")

	// WebSocket
	r.HandleFunc("/ws", wsMgr.Handle)

	// 前端静态文件
	r.PathPrefix("/").Handler(http.FileServer(http.FS(assets)))

	// CORS
	cors := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	// 创建服务器
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	server := &http.Server{
		Addr:         addr,
		Handler:      cors(r),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// 启动服务器
	go func() {
		fmt.Printf("Server starting on http://%s\n", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		}
	}()

	// 等待退出信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	fmt.Println("Shutting down server...")

	// 优雅关闭
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "Server shutdown error: %v\n", err)
	}

	// 停止所有实例
	instanceMgr.StopAll()

	fmt.Println("Server stopped")
}
