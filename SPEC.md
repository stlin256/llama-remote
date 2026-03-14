# Llama Remote - 规格说明书

## 1. 项目概述

**项目名称**: Llama Remote
**项目类型**: Linux桌面/Web应用
**核心功能**: 优雅控制本地运行的llama.cpp实例，提供现代化的视觉UI
**目标用户**: 在本地运行大语言模型的技术用户

---

## 2. 技术栈

| 层级 | 技术选型 |
|------|----------|
| 后端 | Go (单二进制) |
| 前端 | React + TypeScript + Vite |
| UI框架 | Tailwind CSS + Framer Motion |
| 通信 | REST API + WebSocket |
| 部署 | 单一Go二进制（内嵌前端静态资源） |

---

## 3. UI/UX 设计规范

### 3.1 整体风格

- **设计语言**: 类似 Tailscale 的现代极简风格
- **主题**: 深色模式为主，辅以浅色切换
- **背景**: 深灰渐变 (#0a0a0f → #1a1a2e) + 动态光晕效果

### 3.2 毛玻璃效果

```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}
```

### 3.3 色彩系统

| 用途 | 颜色 |
|------|------|
| 主色 | #6366f1 (Indigo) |
| 强调色 | #22d3ee (Cyan) |
| 成功 | #10b981 (Emerald) |
| 警告 | #f59e0b (Amber) |
| 错误 | #ef4444 (Red) |
| 背景 | #0a0a0f / #1a1a2e |
| 文字 | #f8fafc / #94a3b8 |

### 3.4 动效规范

- **页面切换**: 滑入滑出，300ms ease-out
- **卡片悬停**: scale(1.02) + 阴影增强，150ms
- **按钮点击**: scale(0.98)，100ms
- **列表加载**: 交错渐入 (stagger: 50ms)
- **状态变化**: 颜色渐变过渡，200ms

### 3.5 字体

- **主字体**: Inter, system-ui, sans-serif
- **等宽字体**: JetBrains Mono (用于路径、日志)

---

## 4. 功能规格

### 4.1 全局设置

**路径配置**
- llama.cpp 二进制路径（llama-server可执行文件）
- 模型根目录（存放模型的文件夹）
- 日志存储目录

**Web服务配置**
- 监听地址 (默认 0.0.0.0)
- 监听端口 (默认 8080)

### 4.2 模型扫描

**扫描规则**
- 递归扫描模型根目录下的所有 .gguf 文件
- 递归扫描所有 .gguf.mmproj 文件
- 显示：文件名、相对路径、文件大小、修改时间
- 自动识别同目录下的 mmproj 文件（智能配对）

**模型信息展示**
```
模型名称 (从文件名提取)
路径: /path/to/model.gguf
大小: 35.2 GB
推荐参数: n-gl: 999, context: 8192
```

### 4.3 实例管理

**实例结构**
```yaml
name: "Qwen开发环境"          # 用户自定义名称
llama_bin: "/path/to/llama-server"
model: "/path/to/model.gguf"
mmproj: "/path/to/mmproj.gguf"
params:                       # 启动参数
  ngl: 999
  context: 8192
  host: "0.0.0.0"
  port: 5000
  flash_attention: true
  # ... 其他参数
prompt_template: "default"    # 关联的提示词模板
```

**实例操作**
- 创建新实例（选择模型 + 配置参数）
- 编辑实例配置
- 复制实例配置
- 删除实例
- 启动 / 停止 / 重启

**实例状态**
- 已停止 (灰色)
- 启动中 (黄色脉冲)
- 运行中 (绿色)
- 错误 (红色)

### 4.4 参数配置

**预设参数**
- ngl (GPU层数)
- context (上下文长度)
- host / port
- threads
- flash_attention (-fa)
- mlock (-mlock)
- tensor_split
- no-mmap
- batch_size
- prompt_cache
- 其他自定义参数

**参数预设模板**
- 保存当前参数为模板
- 模板命名（e.g., "长上下文", "高速模式"）
- 从模板加载参数

### 4.5 GPU 性能监控

**监控指标** (通过 nvidia-smi 获取)
| 指标 | 说明 |
|------|------|
| GPU利用率 | GPU计算占用百分比 |
| 显存使用 | 已用/总量 (GB) |
| 温度 | GPU温度 (°C) |
| 风扇速度 | 风扇转速百分比 |
| 功率 | 当前功耗 (W) |
| GPU性能受限原因 | 如: None, GPU Cap, VRAM Cap, Thermal |
| 显存访问负载 | Low/Medium/High |

**显示方式**
- 每个实例卡片显示关键指标
- 详情面板显示完整监控
- 刷新频率: 每2秒

### 4.6 日志系统

**日志级别**
- DEBUG
- INFO
- WARNING
- ERROR

**日志内容**
- llama-server 输出 (stdout + stderr)
- 启动命令记录
- 系统事件

**展示方式**
- 实时WebSocket流
- 可过滤日志级别
- 可搜索关键词
- 支持滚动查看历史日志

**错误处理**
- 检测到ERROR级别自动弹出通知
- 可点击跳转到日志详情

### 4.7 系统提示词模板

**模板结构**
```yaml
name: "代码助手"
system_prompt: |
  你是一个专业的编程助手...
  # 可以包含变量: {{model_name}}
variables:
  - name: "model_name"
    default: "CodeGen"
```

**模板操作**
- 创建新模板
- 编辑模板
- 复制模板
- 删除模板
- 切换实例使用的模板

---

## 5. 页面结构

### 5.1 页面列表

1. **仪表盘** (Dashboard)
   - 实例概览卡片
   - GPU状态总览
   - 快速启动按钮

2. **实例管理** (Instances)
   - 实例列表
   - 创建/编辑实例

3. **模型库** (Models)
   - 扫描模型
   - 模型详情

4. **模板** (Templates)
   - 启动参数模板
   - 提示词模板

5. **日志** (Logs)
   - 实时日志流
   - 历史日志

6. **设置** (Settings)
   - 全局配置
   - 外观设置

### 5.2 布局

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Llama Remote          [GPU] [通知] [设置]      │ ← Header
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│  仪表盘 │              主内容区域                         │
│  实例   │                                                │
│  模型   │         (根据页面动态变化)                      │
│  模板   │                                                │
│  日志   │                                                │
│  设置   │                                                │
│        │                                                │
└────────┴────────────────────────────────────────────────┘
     ↑ Sidebar
```

---

## 6. API 设计

### 6.1 REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/config | 获取全局配置 |
| PUT | /api/config | 更新全局配置 |
| GET | /api/instances | 获取所有实例 |
| POST | /api/instances | 创建实例 |
| GET | /api/instances/:id | 获取实例详情 |
| PUT | /api/instances/:id | 更新实例 |
| DELETE | /api/instances/:id | 删除实例 |
| POST | /api/instances/:id/start | 启动实例 |
| POST | /api/instances/:id/stop | 停止实例 |
| GET | /api/models | 扫描模型 |
| GET | /api/templates | 获取参数模板 |
| POST | /api/templates | 保存参数模板 |
| GET | /api/prompts | 获取提示词模板 |
| POST | /api/prompts | 保存提示词模板 |
| GET | /api/gpu | 获取GPU状态 |

### 6.2 WebSocket

| 事件 | 方向 | 说明 |
|------|------|------|
| log | Server→Client | 日志推送 |
| stats | Server→Client | GPU监控数据 |
| instance_status | Server→Client | 实例状态变化 |

---

## 7. 数据存储

### 7.1 配置文件结构

```
~/.llama-remote/
├── config.yaml              # 全局配置
├── instances.yaml           # 实例配置
├── templates.yaml           # 参数模板
├── prompts.yaml            # 提示词模板
└── logs/                   # 日志目录
```

### 7.2 配置格式 (YAML)

```yaml
# config.yaml
server:
  host: "0.0.0.0"
  port: 8080

paths:
  llama_bin: "/home/user/llama.cpp/build/bin/llama-server"
  models_dir: "/home/user/models"
  log_dir: "/home/user/.llama-remote/logs"

# instances.yaml
instances:
  - id: "uuid"
    name: "Qwen开发环境"
    llama_bin: "/path/to/llama-server"
    model: "/path/to/model.gguf"
    mmproj: ""
    params:
      ngl: 999
      context: 8192
      host: "0.0.0.0"
      port: 5000
      fa: true
    prompt_template: ""
    status: "stopped"
```

---

## 8. 部署方式

### 8.1 方式一: 直接运行

```bash
# 下载release版本
wget https://github.com/xxx/llama-remote/releases/latest/llama-remote

# 赋予执行权限
chmod +x llama-remote

# 运行
./llama-remote

# 或指定配置目录
./llama-remote --config /path/to/config
```

### 8.2 方式二: Systemd 服务

```bash
# 安装服务
sudo ./llama-remote install

# 启动
sudo systemctl start llama-remote

# 开机自启
sudo systemctl enable llama-remote
```

### 8.3 方式三: Docker (可选)

```yaml
version: '3.8'
services:
  llama-remote:
    image: llama-remote:latest
    ports:
      - "8080:8080"
    volumes:
      - ~/.llama-remote:/root/.llama-remote
      - /path/to/models:/models
    environment:
      - LLAMA_BIN=/path/to/llama-server
```

---

## 9. 验收标准

### 9.1 功能验收

- [ ] 可配置llama.cpp路径
- [ ] 可扫描并显示所有gguf/mmproj模型
- [ ] 可创建、编辑、删除实例
- [ ] 可启动、停止llama-server实例
- [ ] 多个实例可同时运行
- [ ] 可实时监控GPU状态
- [ ] 可实时查看日志流
- [ ] 可保存/切换提示词模板
- [ ] 错误状态自动通知

### 9.2 UI验收

- [ ] 毛玻璃效果正常显示
- [ ] 页面切换动画流畅
- [ ] 卡片悬停动效正常
- [ ] 响应式布局正常
- [ ] 深色主题正常

### 9.3 部署验收

- [ ] 单二进制可直接运行
- [ ] 配置文件正确加载
- [ ] 日志正确写入
- [ ] Web界面可访问

---

## 10. 未来扩展

- [ ] Docker集成（自动检测宿主机llama.cpp）
- [ ] 模型下载功能
- [ ] API密钥管理
- [ ] 统计面板（token消耗等）
- [ ] 主题自定义
- [ ] 多语言支持
