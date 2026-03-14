#!/bin/bash

# Build script for llama-remote
# Usage: ./build.sh

set -e

echo "=== Building Llama Remote ==="

# Build frontend
echo "Building frontend..."
cd web
npm install
npm run build
cd ..

# Build Go backend with embed
echo "Building Go backend..."
go build -o llama-remote ./cmd/server

echo "=== Build complete: llama-remote ==="
