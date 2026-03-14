# Llama Remote 开发指南

## 项目结构

```
llama_remote/
├── cmd/server/          # Go后端
│   ├── main.go         # 入口
│   └── dist/           # 嵌入的前端构建文件
├── pkg/                # 后端模块
│   ├── config/         # 配置管理
│   ├── instance/       # 实例管理
│   ├── gpu/            # GPU监控 (nvidia-smi)
│   ├── logs/           # 日志系统
│   ├── models/         # 模型扫描
│   ├── templates/      # 参数模板
│   ├── prompts/        # 提示词模板
│   └── websocket/       # WebSocket通信
├── web/                # React前端
│   ├── src/
│   │   ├── components/ # UI组件
│   │   ├── pages/     # 页面
│   │   ├── store/     # Zustand状态管理
│   │   └── hooks/     # API钩子
│   └── dist/          # 构建输出 (嵌入到Go)
├── deploy.py           # 部署脚本 (含服务器密码)
├── build.ps1          # Windows构建脚本
└── SPEC.md            # 规格说明书
```

## 开发流程

### 1. 本地开发

```bash
# 进入项目目录
cd llama_remote

# 启动前端开发服务器
cd web
npm run dev

# 单独启动后端 (可选)
go run ./cmd/server
```

### 2. 前端开发

```bash
cd web

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

### 3. 后端开发

```bash
# 运行
go run ./cmd/server

# 交叉编译Linux版本
GOOS=linux GOARCH=amd64 go build -o llama-remote ./cmd/server
```

## 部署流程

### 自动部署 (推荐)

```bash
# 运行部署脚本 (会自动构建并上传)
python deploy.py
```

### 手动部署

```bash
# 1. 交叉编译
GOOS=linux GOARCH=amd64 go build -o llama-remote ./cmd/server

# 2. 上传到服务器
scp llama-remote user@server:~/

# 3. SSH到服务器运行
ssh user@server
./llama-remote
```

### 服务器配置

1. 访问 `http://server:8080`
2. 进入 **设置** 页面
3. 配置：
   - llama.cpp 二进制路径 (如 `/home/user/llama.cpp/build/bin/llama-server`)
   - 模型目录 (如 `/home/user/models`)
4. 保存后即可使用

## 功能说明

### 实例管理
- 创建/编辑/删除实例
- 启动/停止 llama-server
- 每个实例独立保存配置

### 模型扫描
- 递归扫描模型目录
- 自动识别 gguf 和 mmproj 文件
- 显示文件大小

### GPU监控
- GPU利用率
- 显存使用/总量
- 温度、风扇、功率
- 性能受限原因

### 日志
- 实时WebSocket流
- 日志级别过滤
- 关键词搜索

### 模板
- 参数模板：保存常用参数组合
- 提示词模板：系统提示词管理
