#!/bin/bash

# Windows build script using Git Bash or WSL
# This builds Linux amd64 binary

set -e

echo "=== Building Llama Remote for Linux ==="

# Build frontend
echo "[1/2] Building frontend..."
cd web
npm install
npm run build
cd ..

# Build Go backend for Linux
echo "[2/2] Building Go backend for Linux amd64..."
GOOS=linux GOARCH=amd64 go build -o llama-remote-linux-amd64 ./cmd/server

echo ""
echo "=== Build complete ==="
echo "Output: llama-remote-linux-amd64"
echo ""
echo "To deploy to Linux server:"
echo "  scp llama-remote-linux-amd64 user@server:/path/to/"
echo "  ssh user@server"
echo "  ./llama-remote-linux-amd64"
