#!/usr/bin/env bash
set -euo pipefail

echo "=== Ollama Setup ==="

if ! command -v ollama &> /dev/null; then
  echo "Ollama not found. Install from: https://ollama.com/download"
  exit 1
fi

echo "Pulling llama3.2 (small, fast — ~2GB)..."
ollama pull llama3.2

echo "Verifying model is available..."
ollama list | grep llama3.2

echo "Done! Run the example with: npx tsx src/main.ts"
