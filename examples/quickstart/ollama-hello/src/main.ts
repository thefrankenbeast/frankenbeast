import { OllamaAdapter } from "../../../../frankenfirewall/src/adapters/ollama/ollama-adapter.js";
import type { UnifiedRequest } from "../../../../frankenfirewall/src/types/unified-request.js";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const model = process.env.OLLAMA_MODEL ?? "llama3.2";

const adapter = new OllamaAdapter({ baseUrl, model });

const request: UnifiedRequest = {
  id: randomUUID(),
  provider: "local-ollama",
  model,
  system: "You are a helpful assistant. Be concise.",
  messages: [
    { role: "user", content: "Explain what a guardrail framework does in one sentence." },
  ],
  max_tokens: 256,
};

console.log("--- Frankenbeast: Ollama Hello ---");
console.log(`Request ID: ${request.id}`);
console.log(`Model: ${request.model} (local)`);
console.log(`Endpoint: ${baseUrl}`);
console.log(`Prompt: "${request.messages[0]!.content}"`);
console.log(`Cost: $0.00 (local model)`);
console.log();

try {
  const providerRequest = adapter.transformRequest(request);
  const rawResponse = await adapter.execute(providerRequest);
  const unified = adapter.transformResponse(rawResponse, request.id);

  console.log("--- Response ---");
  console.log(`Content: ${unified.content}`);
  console.log(`Finish reason: ${unified.finish_reason}`);
  console.log();
  console.log("--- Usage ---");
  console.log(`Input tokens:  ${unified.usage.input_tokens}`);
  console.log(`Output tokens: ${unified.usage.output_tokens}`);
  console.log(`Cost (USD):    $${unified.usage.cost_usd.toFixed(6)} (always zero for local)`);
  console.log();
  console.log("--- Capabilities ---");
  console.log(`Function calling: ${adapter.validateCapabilities("function_calling")}`);
  console.log(`Vision:           ${adapter.validateCapabilities("vision")}`);
  console.log(`System prompt:    ${adapter.validateCapabilities("system_prompt")}`);
} catch (err) {
  console.error("Request failed. Is Ollama running? Try: ollama serve");
  console.error(err);
  process.exit(1);
}
