# Frankenbeast Examples

Runnable examples showing how to integrate Frankenbeast guardrails with different AI LLM providers.

## Tiers

### Quickstart (start here)

| Example | Provider | API Key? | Description |
|---------|----------|----------|-------------|
| [claude-hello](quickstart/claude-hello/) | Anthropic Claude | Yes | Send one prompt through Claude with guardrail normalization |
| [openai-hello](quickstart/openai-hello/) | OpenAI GPT | Yes | Same flow with OpenAI — identical UnifiedResponse shape |
| [ollama-hello](quickstart/ollama-hello/) | Ollama (local) | No | Local model, zero cost, zero cloud |
| [custom-adapter](quickstart/custom-adapter/) | Groq (BYO) | Yes | Build your own adapter — implement IAdapter in 4 methods |

### Patterns

| Example | Providers | Description |
|---------|-----------|-------------|
| [multi-provider-fallback](patterns/multi-provider-fallback/) | All 3 | Claude → OpenAI → Ollama cascade with automatic failover |
| [cost-aware-routing](patterns/cost-aware-routing/) | All 3 | Route by complexity: simple → free, complex → premium |
| [tool-calling](patterns/tool-calling/) | Claude, OpenAI | Tool calls normalized through guardrails |
| [local-model-gallery](patterns/local-model-gallery/) | Ollama x4 | Compare Llama, Mistral, Qwen, CodeLlama side by side |

### Scenarios

| Example | API Key? | Description |
|---------|----------|-------------|
| [code-review-agent](scenarios/code-review-agent/) | No | Full Beast Loop with FakeLlmAdapter — plan, critique, execute |
| [research-agent-hitl](scenarios/research-agent-hitl/) | No | HITL approval flow with Ollama — budget gates and human approval |
| [privacy-first-local](scenarios/privacy-first-local/) | No | 100% self-hosted: Ollama + ChromaDB + PII masking, zero cloud |

### Integration

| Example | Description |
|---------|-------------|
| [openclaw-integration](openclaw-integration/) | Docker Compose wrapper for external agent with firewall proxy |

## Running an example

```bash
cd examples/quickstart/claude-hello
cp .env.example .env        # Add your API key
npx tsx src/main.ts
```

## Prerequisites

- **Node.js >= 20**
- **For local models:** [Ollama](https://ollama.com/download) installed and running
- **For cloud providers:** API keys from [Anthropic](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/)

## Architecture

Every example uses the same adapter pattern:

```
UnifiedRequest → adapter.transformRequest() → adapter.execute() → adapter.transformResponse() → UnifiedResponse
```

The `UnifiedResponse` shape is identical regardless of which provider you use:

```typescript
{
  schema_version: 1,
  id: string,
  model_used: string,
  content: string | null,
  tool_calls: ToolCall[],
  finish_reason: "stop" | "tool_use" | "length" | "content_filter",
  usage: { input_tokens, output_tokens, cost_usd }
}
```

Want to add a new provider? See the [custom-adapter](quickstart/custom-adapter/) quickstart.
