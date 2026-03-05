# Cost-Aware Routing Pattern

Routes LLM requests to different providers based on prompt complexity, minimizing cost without sacrificing quality where it matters. Simple questions go to a free local model, moderate requests go to a cheap cloud tier, and only complex prompts are routed to the premium provider.

## Tier-Based Routing

The pattern defines three provider tiers, each with different cost and capability profiles:

| Tier | Provider | Input/1M | Output/1M | Best for |
|------|----------|----------|-----------|----------|
| **free** | Ollama (llama3.2, local) | FREE | FREE | Short factual questions, simple lookups |
| **cheap** | OpenAI (gpt-4o-mini) | $0.15 | $0.60 | Multi-sentence explanations, moderate reasoning |
| **premium** | Claude (claude-sonnet-4-6) | $3.00 | $15.00 | Deep analysis, multi-step reasoning, long-form generation |

## Complexity Estimation

The router uses a simple character-count heuristic to classify prompt complexity:

- **simple** -- total message content under 100 characters. Short questions, lookups, arithmetic.
- **moderate** -- total content between 100 and 499 characters. Multi-sentence requests that require explanation or comparison.
- **complex** -- total content 500 characters or more. Detailed analysis requests, multi-dimensional comparisons, design decisions.

This heuristic is intentionally simple. In production, you might replace it with token counting, keyword analysis, or even a lightweight classifier that detects reasoning depth.

## Routing Logic

Each complexity level maps to an ordered list of preferred tiers:

```
simple   -> free   -> cheap   -> premium
moderate -> cheap  -> free    -> premium
complex  -> premium -> cheap  -> free
```

The router selects the first available provider matching the preferred tier. If that provider fails (network error, rate limit, missing API key), it falls through to the next tier in the preference list. This ensures the system always returns a response as long as at least one provider is reachable.

## When to Use Local vs Cloud

**Use local models (Ollama) when:**
- The prompt is short and factual (e.g., "What is 2 + 2?")
- Latency requirements are relaxed (local models can be slower on CPU)
- You want zero marginal cost for high-volume simple queries
- You need to operate offline or in air-gapped environments

**Use cheap cloud models (gpt-4o-mini) when:**
- The task requires moderate reasoning but not deep analysis
- You need faster response times than local inference provides
- You are processing many requests and need to keep costs low

**Use premium cloud models (Claude Sonnet) when:**
- The task involves complex reasoning, nuance, or multi-step analysis
- Output quality is more important than cost
- The prompt contains domain-specific context that benefits from a larger model

## Prerequisites

- Node.js 18+
- At least one of:
  - `ANTHROPIC_API_KEY` set in environment (enables premium tier)
  - `OPENAI_API_KEY` set in environment (enables cheap tier)
  - Ollama running locally (default: `http://localhost:11434`) (free tier, always included)

## Setup

```bash
cp .env.example .env
# Edit .env with your API keys (set whichever you have)
```

## Run

```bash
npm start
```

## Expected Output

```
=== Cost-Aware Routing Pattern ===

--- Available Providers ---
Provider                          Tier    Input/1M   Output/1M
----------------------------------------------------------------
Claude (claude-sonnet-4-6)     premium       $3.00      $15.00
OpenAI (gpt-4o-mini)            cheap       $0.15       $0.60
Ollama (llama3.2, local)         free        FREE        FREE

--- Routing Rules ---
  simple   (<100 chars)  -> free tier   (Ollama)
  moderate (<500 chars)  -> cheap tier  (OpenAI gpt-4o-mini)
  complex  (>=500 chars) -> premium tier (Claude Sonnet)

--- Prompt 1: Simple prompt (short question) ---
  Text:   "What is 2 + 2?"
  Length: 14 chars
  Complexity: simple
  Routed to:  Ollama (llama3.2, local) (free tier)

  Provider: Ollama (llama3.2, local) (free tier)
  Cost:     $0.000000

--- Prompt 2: Moderate prompt (multi-sentence request) ---
  Text:   "Explain the difference between TCP and UDP protocols..."
  Length: 285 chars
  Complexity: moderate
  Routed to:  OpenAI (gpt-4o-mini) (cheap tier)

  Provider: OpenAI (gpt-4o-mini) (cheap tier)
  Cost:     $0.000042

--- Prompt 3: Complex prompt (detailed analysis request) ---
  Text:   "I am designing a distributed event-sourcing system..."
  Length: 823 chars
  Complexity: complex
  Routed to:  Claude (claude-sonnet-4-6) (premium tier)

  Provider: Claude (claude-sonnet-4-6) (premium tier)
  Cost:     $0.008250

--- Summary ---
Total cost across 3 prompts: $0.008292
```

If a preferred provider is unavailable, the router falls through to the next tier automatically. If only Ollama is running, all three prompts will route to the local model at zero cost.
