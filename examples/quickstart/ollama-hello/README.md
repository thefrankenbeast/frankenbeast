# Ollama Hello -- Quickstart (Local Models)

Send a single prompt to a locally-running Ollama model through the Frankenbeast adapter layer and get a normalized `UnifiedResponse` back. No API key required, zero cost, and no data ever leaves your machine.

## Why Local Models?

- **No API key needed** -- Ollama runs entirely on your hardware.
- **Zero cost** -- No per-token charges; run as many requests as you want.
- **Privacy** -- Your prompts and responses never leave your machine.
- **Offline capable** -- Works without an internet connection once the model is downloaded.

## Prerequisites

- Node.js >= 20
- [Ollama](https://ollama.com/) installed and running

## Installing Ollama

### Linux

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### macOS

Download from [ollama.com/download](https://ollama.com/download) or install via Homebrew:

```bash
brew install ollama
```

### Windows

Download the installer from [ollama.com/download](https://ollama.com/download).

## Setup

1. Run the setup script to pull the default model:

```bash
npm run setup
# or: bash setup-ollama.sh
```

This pulls `llama3.2` (~2GB), a small and fast model suitable for quickstart examples.

2. Make sure Ollama is running:

```bash
ollama serve
```

3. (Optional) Copy and edit the environment file:

```bash
cp .env.example .env
```

The defaults work out of the box -- only edit `.env` if you want to change the model or Ollama endpoint.

## Run

From this directory:

```bash
npx tsx src/main.ts
```

Or from the project root:

```bash
npx tsx examples/quickstart/ollama-hello/src/main.ts
```

## What This Demonstrates

- **OllamaAdapter** -- The provider-specific adapter that translates between the unified interface and the Ollama Chat API (`/api/chat`).
- **UnifiedRequest** -- The provider-agnostic request shape that all adapters accept.
- **UnifiedResponse** -- The normalized response shape returned by every adapter, including content, finish reason, and usage metrics.
- **Zero-cost operation** -- Local models always report `cost_usd: 0`, demonstrating that the cost calculation pipeline works correctly for free providers.
- **Capability validation** -- Querying the adapter's capability matrix to check feature support. Ollama's `llama3.2` supports function calling and system prompts but not vision.

## Expected Output

```
--- Frankenbeast: Ollama Hello ---
Request ID: <uuid>
Model: llama3.2 (local)
Endpoint: http://localhost:11434
Prompt: "Explain what a guardrail framework does in one sentence."
Cost: $0.00 (local model)

--- Response ---
Content: <Ollama's response>
Finish reason: stop

--- Usage ---
Input tokens:  <number>
Output tokens: <number>
Cost (USD):    $0.000000 (always zero for local)

--- Capabilities ---
Function calling: true
Vision:           false
System prompt:    true
```

## Using a Different Model

Edit `.env` or pass environment variables directly:

```bash
OLLAMA_MODEL=mistral npx tsx src/main.ts
```

To see all available models:

```bash
ollama list
```

To pull a new model:

```bash
ollama pull <model-name>
```
