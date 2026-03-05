/**
 * Privacy-First Local Deployment
 *
 * A 100% self-hosted scenario: Ollama for inference, regex-based PII masking,
 * ChromaDB for semantic memory, zero cloud calls. Designed for environments
 * where GDPR, HIPAA, or organizational policy forbids sending data to
 * third-party APIs.
 *
 * Key concepts:
 *   - Deterministic PII detection and masking (email, phone, SSN, credit card)
 *   - OllamaAdapter for zero-cost local inference
 *   - ChromaDB health check (optional, no data sent to cloud)
 *   - Full audit trail: request ID, PII items masked, token counts, cost, cloud calls
 */

import { OllamaAdapter } from "../../../../frankenfirewall/src/adapters/ollama/ollama-adapter.js";
import type { UnifiedRequest } from "../../../../frankenfirewall/src/types/unified-request.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const CHROMADB_URL = process.env.CHROMADB_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// PII Detection & Masking
// ---------------------------------------------------------------------------

interface PiiMatch {
  type: string;
  original: string;
  masked: string;
  index: number;
}

interface MaskResult {
  maskedText: string;
  matches: PiiMatch[];
}

const PII_PATTERNS: { type: string; pattern: RegExp; mask: string }[] = [
  {
    type: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: "[EMAIL_REDACTED]",
  },
  {
    type: "ssn",
    // SSN: 3 digits, separator, 2 digits, separator, 4 digits
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    mask: "[SSN_REDACTED]",
  },
  {
    type: "credit_card",
    // Credit card: 4 groups of 4 digits separated by dashes or spaces
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    mask: "[CC_REDACTED]",
  },
  {
    type: "phone",
    // US phone: optional country code, area code, number
    pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    mask: "[PHONE_REDACTED]",
  },
];

/**
 * Mask PII in the given text using deterministic regex patterns.
 * No cloud calls, no ML models -- purely local, auditable, and fast.
 *
 * Patterns are applied in priority order: email > SSN > credit card > phone.
 * Earlier matches take precedence when ranges overlap.
 */
function maskPii(text: string): MaskResult {
  const allMatches: PiiMatch[] = [];

  // Collect all matches across all pattern types
  for (const { type, pattern, mask } of PII_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      allMatches.push({
        type,
        original: match[0],
        masked: mask,
        index: match.index,
      });
    }
  }

  // Sort by index descending so we can replace from end to start
  // without shifting indices
  allMatches.sort((a, b) => b.index - a.index);

  // Deduplicate overlapping matches -- keep the first (highest priority) match
  const deduped: PiiMatch[] = [];
  let lastStart = Infinity;
  for (const m of allMatches) {
    const end = m.index + m.original.length;
    if (end <= lastStart) {
      deduped.push(m);
      lastStart = m.index;
    }
  }

  // Apply replacements from end to start
  let maskedText = text;
  for (const m of deduped) {
    maskedText =
      maskedText.slice(0, m.index) +
      m.masked +
      maskedText.slice(m.index + m.original.length);
  }

  // Return matches in original order (ascending index)
  deduped.reverse();

  return { maskedText, matches: deduped };
}

// ---------------------------------------------------------------------------
// ChromaDB Health Check
// ---------------------------------------------------------------------------

async function checkChromaDb(): Promise<{ reachable: boolean; version?: string; error?: string }> {
  try {
    const response = await fetch(`${CHROMADB_URL}/api/v1/heartbeat`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      return { reachable: false, error: `HTTP ${response.status}` };
    }

    const body = (await response.json()) as Record<string, unknown>;
    return { reachable: true, version: String(body.nanosecond_heartbeat ?? "unknown") };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Adapter Helper -- send a masked prompt through the OllamaAdapter pipeline
// ---------------------------------------------------------------------------

let requestCounter = 0;

async function sendMaskedPrompt(
  adapter: OllamaAdapter,
  maskedText: string,
): Promise<{ content: string; inputTokens: number; outputTokens: number; costUsd: number }> {
  requestCounter++;
  const requestId = `privacy-req-${requestCounter}`;

  const unifiedRequest: UnifiedRequest = {
    id: requestId,
    provider: "ollama",
    model: OLLAMA_MODEL,
    system:
      "You are a helpful assistant running in a privacy-first local deployment. " +
      "All PII has been masked before reaching you. Analyze the request and respond helpfully. " +
      "Never attempt to reconstruct or guess masked PII values.",
    messages: [{ role: "user", content: maskedText }],
    max_tokens: 512,
  };

  // IAdapter pipeline: transformRequest -> execute -> transformResponse
  const providerRequest = adapter.transformRequest(unifiedRequest);
  const rawResponse = await adapter.execute(providerRequest);
  const unifiedResponse = adapter.transformResponse(rawResponse, requestId);

  return {
    content: unifiedResponse.content ?? "",
    inputTokens: unifiedResponse.usage.input_tokens,
    outputTokens: unifiedResponse.usage.output_tokens,
    costUsd: unifiedResponse.usage.cost_usd,
  };
}

// ---------------------------------------------------------------------------
// Audit Trail
// ---------------------------------------------------------------------------

interface AuditRecord {
  requestId: string;
  timestamp: string;
  piiItemsMasked: number;
  piiTypes: string[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  dataSentToCloud: "NONE";
  llmProvider: "ollama (local)";
}

function printAuditTrail(audit: AuditRecord): void {
  console.log();
  console.log("========================================");
  console.log("  AUDIT TRAIL");
  console.log("========================================");
  console.log(`  Request ID:         ${audit.requestId}`);
  console.log(`  Timestamp:          ${audit.timestamp}`);
  console.log(`  PII items masked:   ${audit.piiItemsMasked}`);
  console.log(`  PII types found:    ${audit.piiTypes.length > 0 ? audit.piiTypes.join(", ") : "none"}`);
  console.log(`  Input tokens:       ${audit.inputTokens}`);
  console.log(`  Output tokens:      ${audit.outputTokens}`);
  console.log(`  Cost:               $${audit.costUsd.toFixed(6)}`);
  console.log(`  Data sent to cloud: ${audit.dataSentToCloud}`);
  console.log(`  LLM provider:       ${audit.llmProvider}`);
  console.log("========================================");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Privacy-First Local Deployment ===");
  console.log();
  console.log("This scenario runs entirely on local infrastructure.");
  console.log("No data leaves your network. Zero cloud API calls.");
  console.log();
  console.log(`Ollama endpoint: ${OLLAMA_BASE_URL}`);
  console.log(`Model: ${OLLAMA_MODEL}`);
  console.log(`ChromaDB endpoint: ${CHROMADB_URL}`);
  console.log();

  // -------------------------------------------------------------------------
  // Step 1: ChromaDB health check (optional)
  // -------------------------------------------------------------------------

  console.log("--- Step 1: ChromaDB Health Check ---");
  const chromaStatus = await checkChromaDb();
  if (chromaStatus.reachable) {
    console.log(`  ChromaDB is reachable (heartbeat: ${chromaStatus.version})`);
  } else {
    console.log(`  ChromaDB is not reachable: ${chromaStatus.error}`);
    console.log("  (This is optional -- the scenario continues without it.)");
  }
  console.log();

  // -------------------------------------------------------------------------
  // Step 2: PII Detection & Masking
  // -------------------------------------------------------------------------

  const TEST_INPUT = [
    "Please analyze this customer record:",
    "Name: John Smith",
    "Email: john.smith@example.com",
    "Phone: 555-123-4567",
    "SSN: 123-45-6789",
    "Credit Card: 4111-1111-1111-1111",
    "Issue: Customer reports unauthorized transactions on their account.",
  ].join("\n");

  console.log("--- Step 2: PII Detection & Masking ---");
  console.log();
  console.log("  Original input:");
  for (const line of TEST_INPUT.split("\n")) {
    console.log(`    ${line}`);
  }
  console.log();

  const { maskedText, matches } = maskPii(TEST_INPUT);

  console.log(`  PII items detected: ${matches.length}`);
  for (const m of matches) {
    console.log(`    [${m.type}] "${m.original}" -> "${m.masked}"`);
  }
  console.log();
  console.log("  Masked input (sent to LLM):");
  for (const line of maskedText.split("\n")) {
    console.log(`    ${line}`);
  }
  console.log();

  // -------------------------------------------------------------------------
  // Step 3: Send masked input to local LLM
  // -------------------------------------------------------------------------

  console.log("--- Step 3: Local LLM Inference ---");
  console.log("  Sending masked input to Ollama...");
  console.log();

  const adapter = new OllamaAdapter({
    model: OLLAMA_MODEL,
    baseUrl: OLLAMA_BASE_URL,
  });

  try {
    const response = await sendMaskedPrompt(adapter, maskedText);

    console.log(`  Response (${response.outputTokens} tokens):`);
    console.log();
    const indentedResponse = response.content
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    console.log(indentedResponse);
    console.log();

    // -----------------------------------------------------------------------
    // Step 4: Audit Trail
    // -----------------------------------------------------------------------

    const uniqueTypes = [...new Set(matches.map((m) => m.type))];

    const audit: AuditRecord = {
      requestId: `privacy-req-${requestCounter}`,
      timestamp: new Date().toISOString(),
      piiItemsMasked: matches.length,
      piiTypes: uniqueTypes,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUsd: response.costUsd,
      dataSentToCloud: "NONE",
      llmProvider: "ollama (local)",
    };

    printAuditTrail(audit);
  } catch (err) {
    console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    console.log();
    console.log("  Make sure Ollama is running locally:");
    console.log("    docker compose up -d    # or: ollama serve");
    console.log(`    ollama pull ${OLLAMA_MODEL}`);
    console.log();

    // Still print audit trail even on failure -- shows zero cloud exposure
    const uniqueTypes = [...new Set(matches.map((m) => m.type))];

    const audit: AuditRecord = {
      requestId: `privacy-req-${requestCounter}`,
      timestamp: new Date().toISOString(),
      piiItemsMasked: matches.length,
      piiTypes: uniqueTypes,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      dataSentToCloud: "NONE",
      llmProvider: "ollama (local)",
    };

    printAuditTrail(audit);
  }
}

main().catch((err) => {
  console.error("Privacy-first scenario failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
