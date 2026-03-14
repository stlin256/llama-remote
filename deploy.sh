#!/bin/bash
# deploy.sh - 一键部署脚本

# 服务器信息（请修改）
HOST="your-server-ip"
USER="your-username"
PORT="22"

# 构建
echo "=== 构建中... ==="
GOOS=linux GOARCH=amd64 go build -o llama-remote ./cmd/server

echo "=== 上传到服务器... ==="
scp -P $PORT llama-remote $USER@$HOST:~/

echo "=== 完成! ==="
echo "服务器: $USER@$HOST"
echo ""
echo "SSH连接后运行:"
echo "  ./llama-remote"
echo ""
echo "然后访问: http://$HOST:8080"
