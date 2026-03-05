/**
 * Shared stub factories for cross-module integration tests.
 *
 * Each factory returns a mock implementation of a port interface
 * with vi.fn() spies for verification. Override individual methods
 * via the `overrides` parameter.
 */

import { vi } from 'vitest';

// ─── MOD-01 Firewall Types ──────────────────────────────────────────────────

import type {
  IAdapter,
  UnifiedRequest,
  UnifiedResponse,
  GuardrailsConfig,
} from '@franken/firewall';

// ─── MOD-06 Critique Port Interfaces ────────────────────────────────────────

import type {
  GuardrailsPort,
  MemoryPort,
  ObservabilityPort,
  EscalationPort,
  SafetyRule,
  TokenSpend,
} from '@franken/critique';

// ─── MOD-07 Governor Port Interfaces ────────────────────────────────────────

import type {
  GovernorMemoryPort,
  EpisodicTraceRecord,
  ApprovalChannel,
  ApprovalRequest,
  ApprovalResponse,
} from '@franken/governor';

// ─── MOD-03 Brain Interfaces ────────────────────────────────────────────────

import type { ILlmClient } from 'franken-brain';
import type { IPiiScanner, ScanResult } from 'franken-brain';

// ─── MOD-04 Planner Module Interfaces ───────────────────────────────────────

import type {
  GuardrailsModule,
  SkillsModule,
  MemoryModule,
  SelfCritiqueModule,
  Intent,
  ADR,
  KnownError,
  ProjectContext,
  RationaleBlock,
  VerificationResult,
  Skill,
} from 'franken-planner';

// ─── MOD-08 Heartbeat Module Interfaces ─────────────────────────────────────

import type {
  IMemoryModule as HeartbeatMemoryModule,
  IObservabilityModule as HeartbeatObservabilityModule,
  IPlannerModule,
  ICritiqueModule,
  IHitlGateway,
} from 'franken-heartbeat';

// =============================================================================
// MOD-01: Firewall Stubs
// =============================================================================

export function makeAdapter(overrides: Partial<IAdapter> = {}): IAdapter {
  return {
    transformRequest: vi.fn((req: UnifiedRequest) => req),
    execute: vi.fn(async () => ({
      id: 'resp-001',
      model: 'test-model',
      content: [{ type: 'text', text: 'Hello from mock LLM' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    })),
    transformResponse: vi.fn((_raw: unknown, requestId: string): UnifiedResponse => ({
      schema_version: 1,
      id: requestId,
      model_used: 'test-model',
      content: 'Hello from mock LLM',
      tool_calls: [],
      finish_reason: 'stop',
      usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 },
    })),
    validateCapabilities: vi.fn(() => true),
    ...overrides,
  };
}

export function makeGuardrailsConfig(
  overrides: Partial<GuardrailsConfig> = {},
): GuardrailsConfig {
  return {
    project_name: 'test-project',
    security_tier: 'STRICT',
    schema_version: 1,
    agnostic_settings: {
      redact_pii: true,
      max_token_spend_per_call: 10_000,
      allowed_providers: ['anthropic', 'openai'],
    },
    safety_hooks: {
      pre_flight: [],
      post_flight: [],
    },
    ...overrides,
  };
}

// =============================================================================
// MOD-06: Critique Port Stubs
// =============================================================================

const defaultSafetyRules: SafetyRule[] = [
  {
    id: 'no-eval',
    description: 'Disallow eval()',
    pattern: 'eval\\s*\\(',
    severity: 'block',
  },
  {
    id: 'no-rm-rf',
    description: 'Disallow rm -rf',
    pattern: 'rm\\s+-rf',
    severity: 'block',
  },
];

export function makeGuardrailsPort(
  overrides: Partial<GuardrailsPort> = {},
): GuardrailsPort {
  return {
    getSafetyRules: vi.fn(async () => defaultSafetyRules),
    executeSandbox: vi.fn(async () => ({
      success: true,
      output: '',
      exitCode: 0,
      timedOut: false,
    })),
    ...overrides,
  };
}

export function makeMemoryPort(overrides: Partial<MemoryPort> = {}): MemoryPort {
  return {
    searchADRs: vi.fn(async () => []),
    searchEpisodic: vi.fn(async () => []),
    recordLesson: vi.fn(async () => {}),
    ...overrides,
  };
}

const defaultTokenSpend: TokenSpend = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  estimatedCostUsd: 0.01,
};

export function makeObservabilityPort(
  overrides: Partial<ObservabilityPort> = {},
): ObservabilityPort {
  return {
    getTokenSpend: vi.fn(async () => defaultTokenSpend),
    ...overrides,
  };
}

export function makeEscalationPort(
  overrides: Partial<EscalationPort> = {},
): EscalationPort {
  return {
    requestHumanReview: vi.fn(async () => {}),
    ...overrides,
  };
}

// =============================================================================
// MOD-07: Governor Port Stubs
// =============================================================================

export interface GovernorMemoryPortWithTraces extends GovernorMemoryPort {
  readonly traces: EpisodicTraceRecord[];
}

export function makeGovernorMemoryPort(): GovernorMemoryPortWithTraces {
  const traces: EpisodicTraceRecord[] = [];
  return {
    traces,
    recordDecision: vi.fn(async (trace: EpisodicTraceRecord) => {
      traces.push(trace);
    }),
  };
}

export function makeApprovalChannel(
  decision: 'APPROVE' | 'REGEN' | 'ABORT' | 'DEBUG' = 'APPROVE',
  overrides: Partial<ApprovalResponse> = {},
): ApprovalChannel {
  return {
    channelId: 'test-channel',
    requestApproval: vi.fn(async (req: ApprovalRequest): Promise<ApprovalResponse> => ({
      requestId: req.requestId,
      decision,
      respondedBy: 'test-human',
      respondedAt: new Date(),
      ...overrides,
    })),
  };
}

// =============================================================================
// MOD-03: Brain Stubs
// =============================================================================

export function makeLlmClient(response = 'Mock LLM response'): ILlmClient {
  return {
    complete: vi.fn(async () => response),
  };
}

/** Heartbeat's ILlmClient uses Result<string> return type */
export function makeHeartbeatLlmClient(response = 'Mock LLM response') {
  return {
    complete: vi.fn(async () => ({ ok: true as const, value: response })),
  };
}

export function makePiiScanner(
  result: ScanResult = { clean: true },
): IPiiScanner {
  return {
    scan: vi.fn(async () => result),
  };
}

// =============================================================================
// MOD-04: Planner Module Stubs
// =============================================================================

export function makePlannerGuardrailsModule(
  overrides: Partial<GuardrailsModule> = {},
): GuardrailsModule {
  return {
    getSanitizedIntent: vi.fn(async (raw: string): Promise<Intent> => ({
      goal: raw,
      strategy: 'linear',
    })),
    ...overrides,
  };
}

export function makePlannerSkillsModule(
  skills: Skill[] = [
    { name: 'file-read', description: 'Read a file', version: '1.0.0' },
    { name: 'file-write', description: 'Write a file', version: '1.0.0' },
    { name: 'test-run', description: 'Run tests', version: '1.0.0' },
  ],
): SkillsModule {
  return {
    getAvailableSkills: vi.fn(async () => skills),
    hasSkill: vi.fn(async (name: string) => skills.some((s) => s.name === name)),
  };
}

export function makePlannerMemoryModule(
  overrides: Partial<MemoryModule> = {},
): MemoryModule {
  const defaultAdrs: ADR[] = [
    { id: 'ADR-001', title: 'Use TypeScript', status: 'accepted', decision: 'TypeScript for all modules' },
  ];
  const defaultContext: ProjectContext = {
    projectName: 'test-project',
    adrs: defaultAdrs,
    rules: ['no-eval', 'strict-mode'],
  };
  return {
    getADRs: vi.fn(async () => defaultAdrs),
    getKnownErrors: vi.fn(async (): Promise<KnownError[]> => []),
    getProjectContext: vi.fn(async () => defaultContext),
    ...overrides,
  };
}

export function makeSelfCritiqueModule(
  verdict: 'approved' | 'rejected' = 'approved',
): SelfCritiqueModule {
  return {
    verifyRationale: vi.fn(async (_rationale: RationaleBlock): Promise<VerificationResult> => {
      if (verdict === 'approved') return { verdict: 'approved' };
      return { verdict: 'rejected', reason: 'Test rejection' };
    }),
  };
}

// =============================================================================
// MOD-08: Heartbeat Module Stubs
// =============================================================================

export function makeHeartbeatMemoryModule(
  overrides: Partial<HeartbeatMemoryModule> = {},
): HeartbeatMemoryModule {
  return {
    getRecentTraces: vi.fn(async () => []),
    getSuccesses: vi.fn(async () => []),
    getFailures: vi.fn(async () => []),
    recordLesson: vi.fn(async () => {}),
    ...overrides,
  };
}

export function makeHeartbeatObservabilityModule(
  overrides: Partial<HeartbeatObservabilityModule> = {},
): HeartbeatObservabilityModule {
  return {
    getTraces: vi.fn(async () => []),
    getTokenSpend: vi.fn(async () => ({
      totalTokens: 500,
      totalCostUsd: 0.05,
      breakdown: [{ model: 'test-model', tokens: 500, costUsd: 0.05 }],
    })),
    ...overrides,
  };
}

export function makeHeartbeatPlannerModule(): IPlannerModule {
  return {
    injectTask: vi.fn(async () => {}),
  };
}

export function makeHeartbeatCritiqueModule(
  passed = true,
): ICritiqueModule {
  return {
    auditConclusions: vi.fn(async () => ({
      passed,
      reason: passed ? 'All good' : 'Audit failed',
      flaggedItems: passed ? [] : ['issue-1'],
    })),
  };
}

export function makeHeartbeatHitlGateway(): IHitlGateway {
  return {
    sendMorningBrief: vi.fn(async () => {}),
    notifyAlert: vi.fn(async () => {}),
  };
}

// =============================================================================
// Unified Request Builder
// =============================================================================

export function makeUnifiedRequest(
  overrides: Partial<UnifiedRequest> = {},
): UnifiedRequest {
  return {
    id: 'req-001',
    provider: 'anthropic',
    model: 'test-model',
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 1024,
    session_id: 'session-001',
    ...overrides,
  };
}
