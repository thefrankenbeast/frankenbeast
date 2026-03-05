/**
 * Cost-Aware Routing Pattern
 *
 * Routes LLM requests based on prompt complexity:
 *   - Simple prompts  (<100 chars)  -> free local model (Ollama)
 *   - Moderate prompts (<500 chars)  -> cheap cloud model (OpenAI gpt-4o-mini)
 *   - Complex prompts  (>=500 chars) -> premium cloud model (Claude Sonnet)
 *
 * Falls through to the next available tier when the preferred provider
 * is not configured (missing API key) or unreachable.
 */

import { ClaudeAdapter } from "../../../../frankenfirewall/src/adapters/claude/claude-adapter.js";
import type { ClaudeAdapterConfig } from "../../../../frankenfirewall/src/adapters/claude/claude-adapter.js";
import { OpenAIAdapter } from "../../../../frankenfirewall/src/adapters/openai/openai-adapter.js";
import type { OpenAIAdapterConfig } from "../../../../frankenfirewall/src/adapters/openai/openai-adapter.js";
import { OllamaAdapter } from "../../../../frankenfirewall/src/adapters/ollama/ollama-adapter.js";
import type { OllamaAdapterConfig } from "../../../../frankenfirewall/src/adapters/ollama/ollama-adapter.js";
import type { IAdapter } from "../../../../frankenfirewall/src/adapters/i-adapter.js";
import type { UnifiedRequest, Message } from "../../../../frankenfirewall/src/types/unified-request.js";
import type { UnifiedResponse } from "../../../../frankenfirewall/src/types/unified-response.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Provider tier definitions
// ---------------------------------------------------------------------------

interface ProviderTier {
  name: string;
  adapter: IAdapter;
  costPerInputTokenM: number;
  costPerOutputTokenM: number;
  tier: "free" | "cheap" | "premium";
}

// ---------------------------------------------------------------------------
// Build available providers from environment variables
// ---------------------------------------------------------------------------

function buildProviders(): ProviderTier[] {
  const providers: ProviderTier[] = [];

  // Premium tier: Claude Sonnet
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];
  if (anthropicKey) {
    const config: ClaudeAdapterConfig = {
      apiKey: anthropicKey,
      model: "claude-sonnet-4-6",
    };
    providers.push({
      name: "Claude (claude-sonnet-4-6)",
      adapter: new ClaudeAdapter(config),
      costPerInputTokenM: 3,
      costPerOutputTokenM: 15,
      tier: "premium",
    });
  }

  // Cheap tier: OpenAI gpt-4o-mini
  const openaiKey = process.env["OPENAI_API_KEY"];
  if (openaiKey) {
    const config: OpenAIAdapterConfig = {
      apiKey: openaiKey,
      model: "gpt-4o-mini",
    };
    providers.push({
      name: "OpenAI (gpt-4o-mini)",
      adapter: new OpenAIAdapter(config),
      costPerInputTokenM: 0.15,
      costPerOutputTokenM: 0.6,
      tier: "cheap",
    });
  }

  // Free tier: Ollama (local, always available)
  const ollamaBaseUrl = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
  const ollamaConfig: OllamaAdapterConfig = {
    model: "llama3.2",
    baseUrl: ollamaBaseUrl,
  };
  providers.push({
    name: "Ollama (llama3.2, local)",
    adapter: new OllamaAdapter(ollamaConfig),
    costPerInputTokenM: 0,
    costPerOutputTokenM: 0,
    tier: "free",
  });

  return providers;
}

// ---------------------------------------------------------------------------
// Complexity estimation
// ---------------------------------------------------------------------------

type Complexity = "simple" | "moderate" | "complex";

function estimateComplexity(messages: Message[]): Complexity {
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      totalChars += msg.content.length;
    } else {
      for (const block of msg.content) {
        totalChars += (block.text ?? "").length;
      }
    }
  }

  if (totalChars < 100) return "simple";
  if (totalChars < 500) return "moderate";
  return "complex";
}

// ---------------------------------------------------------------------------
// Tier preference mapping: complexity -> ordered list of preferred tiers
// ---------------------------------------------------------------------------

const TIER_PREFERENCE: Record<Complexity, Array<"free" | "cheap" | "premium">> = {
  simple:   ["free", "cheap", "premium"],
  moderate: ["cheap", "free", "premium"],
  complex:  ["premium", "cheap", "free"],
};

// ---------------------------------------------------------------------------
// Select the best provider for a given complexity level
// ---------------------------------------------------------------------------

function selectProvider(
  providers: ProviderTier[],
  complexity: Complexity,
): ProviderTier {
  const preferences = TIER_PREFERENCE[complexity];

  for (const preferredTier of preferences) {
    const match = providers.find((p) => p.tier === preferredTier);
    if (match) return match;
  }

  // Should never happen — Ollama (free tier) is always present
  throw new Error("No providers available");
}

// ---------------------------------------------------------------------------
// Execute a request through a selected provider
// ---------------------------------------------------------------------------

interface RoutingResult {
  response: UnifiedResponse;
  provider: ProviderTier;
  complexity: Complexity;
  durationMs: number;
}

async function executeWithRouting(
  providers: ProviderTier[],
  request: UnifiedRequest,
): Promise<RoutingResult> {
  const complexity = estimateComplexity(request.messages);
  const provider = selectProvider(providers, complexity);

  console.log(`  Complexity: ${complexity}`);
  console.log(`  Routed to:  ${provider.name} (${provider.tier} tier)`);

  const start = performance.now();

  // Try the selected provider first
  try {
    const providerRequest = provider.adapter.transformRequest(request);
    const rawResponse = await provider.adapter.execute(providerRequest);
    const unified = provider.adapter.transformResponse(rawResponse, request.id);
    const durationMs = Math.round(performance.now() - start);

    return { response: unified, provider, complexity, durationMs };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.log(`  [FAIL] ${provider.name}: ${errorMessage}`);
    console.log(`  Falling through to next available tier...`);
  }

  // Fall through to other tiers in preference order
  const preferences = TIER_PREFERENCE[complexity];
  for (const fallbackTier of preferences) {
    const fallback = providers.find(
      (p) => p.tier === fallbackTier && p.name !== provider.name,
    );
    if (!fallback) continue;

    console.log(`  Trying fallback: ${fallback.name} (${fallback.tier} tier)`);
    try {
      const providerRequest = fallback.adapter.transformRequest(request);
      const rawResponse = await fallback.adapter.execute(providerRequest);
      const unified = fallback.adapter.transformResponse(rawResponse, request.id);
      const durationMs = Math.round(performance.now() - start);

      return { response: unified, provider: fallback, complexity, durationMs };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.log(`  [FAIL] ${fallback.name}: ${errorMessage}`);
    }
  }

  throw new Error("All providers failed for this request");
}

// ---------------------------------------------------------------------------
// Cost summary table
// ---------------------------------------------------------------------------

function printProviderTable(providers: ProviderTier[]): void {
  console.log("--- Available Providers ---");
  console.log(
    "Provider".padEnd(30) +
      "Tier".padStart(10) +
      "Input/1M".padStart(12) +
      "Output/1M".padStart(12),
  );
  console.log("-".repeat(64));

  for (const p of providers) {
    const inputStr = p.costPerInputTokenM === 0
      ? "FREE"
      : `$${p.costPerInputTokenM.toFixed(2)}`;
    const outputStr = p.costPerOutputTokenM === 0
      ? "FREE"
      : `$${p.costPerOutputTokenM.toFixed(2)}`;

    console.log(
      p.name.padEnd(30) +
        p.tier.padStart(10) +
        inputStr.padStart(12) +
        outputStr.padStart(12),
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Routing rule display
// ---------------------------------------------------------------------------

function printRoutingRules(): void {
  console.log("--- Routing Rules ---");
  console.log("  simple   (<100 chars)  -> free tier   (Ollama)");
  console.log("  moderate (<500 chars)  -> cheap tier  (OpenAI gpt-4o-mini)");
  console.log("  complex  (>=500 chars) -> premium tier (Claude Sonnet)");
  console.log("  Falls through to next available tier on failure.");
  console.log();
}

// ---------------------------------------------------------------------------
// Demo prompts — three different complexity levels
// ---------------------------------------------------------------------------

const DEMO_PROMPTS: Array<{ label: string; messages: Message[] }> = [
  {
    label: "Simple prompt (short question)",
    messages: [
      { role: "user", content: "What is 2 + 2?" },
    ],
  },
  {
    label: "Moderate prompt (multi-sentence request)",
    messages: [
      {
        role: "user",
        content:
          "Explain the difference between TCP and UDP protocols. " +
          "Cover their reliability guarantees, use cases, and performance characteristics. " +
          "Include examples of applications that typically use each protocol. " +
          "Keep the explanation suitable for a junior developer.",
      },
    ],
  },
  {
    label: "Complex prompt (detailed analysis request)",
    messages: [
      {
        role: "user",
        content:
          "I am designing a distributed event-sourcing system for a financial trading platform. " +
          "The system needs to handle 100,000 events per second with exactly-once processing guarantees. " +
          "Events must be durably stored, replayable, and support point-in-time recovery. " +
          "The read model needs to be eventually consistent within 50ms. " +
          "We are considering three approaches: (1) Apache Kafka with a custom event store, " +
          "(2) EventStoreDB as a dedicated event sourcing database, or " +
          "(3) a PostgreSQL-based solution using LISTEN/NOTIFY with WAL-based replication. " +
          "Please analyze each approach across these dimensions: throughput capacity, " +
          "exactly-once semantics, operational complexity, disaster recovery capabilities, " +
          "schema evolution support, and total cost of ownership for a team of five engineers. " +
          "Provide a recommendation with justification.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const providers = buildProviders();

console.log("=== Cost-Aware Routing Pattern ===");
console.log();

printProviderTable(providers);
printRoutingRules();

let totalCost = 0;

for (let i = 0; i < DEMO_PROMPTS.length; i++) {
  const demo = DEMO_PROMPTS[i]!;
  const promptPreview = typeof demo.messages[0]!.content === "string"
    ? demo.messages[0]!.content
    : "(structured content)";
  const charCount = typeof demo.messages[0]!.content === "string"
    ? demo.messages[0]!.content.length
    : 0;

  console.log(`--- Prompt ${i + 1}: ${demo.label} ---`);
  console.log(`  Text:   "${promptPreview.slice(0, 80)}${promptPreview.length > 80 ? "..." : ""}"`);
  console.log(`  Length: ${charCount} chars`);

  const request: UnifiedRequest = {
    id: randomUUID(),
    provider: "auto",
    model: "auto",
    system: "You are a helpful assistant. Be concise.",
    messages: demo.messages,
    max_tokens: 512,
  };

  try {
    const result = await executeWithRouting(providers, request);

    console.log();
    console.log(`  Provider: ${result.provider.name} (${result.provider.tier} tier)`);
    console.log(`  Model:    ${result.response.model_used}`);
    console.log(`  Duration: ${result.durationMs}ms`);
    console.log(`  Tokens:   ${result.response.usage.input_tokens} in / ${result.response.usage.output_tokens} out`);
    console.log(`  Cost:     $${result.response.usage.cost_usd.toFixed(6)}`);
    console.log(`  Content:  "${(result.response.content ?? "(no content)").slice(0, 120)}..."`);

    totalCost += result.response.usage.cost_usd;
  } catch (err) {
    console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log();
}

console.log("--- Summary ---");
console.log(`Total cost across ${DEMO_PROMPTS.length} prompts: $${totalCost.toFixed(6)}`);
console.log();
console.log("With cost-aware routing, simple prompts use the free local model,");
console.log("moderate prompts use the cheapest cloud tier, and only complex prompts");
console.log("are routed to the premium provider — minimizing cost without sacrificing");
console.log("quality where it matters.");
