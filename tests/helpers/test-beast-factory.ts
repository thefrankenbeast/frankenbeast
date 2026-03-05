/**
 * createTestBeast() — wires all 8 modules together with sensible defaults.
 *
 * Use this factory for end-to-end integration tests. Each module is wired
 * with real implementations where possible, stubs for external services
 * (LLM, ChromaDB, Slack).
 */

import { vi } from 'vitest';

// MOD-01: Firewall
import { runPipeline } from '@franken/firewall';
import type { IAdapter, GuardrailsConfig, PipelineResult, UnifiedRequest } from '@franken/firewall';

// MOD-06: Critique
import { createReviewer } from '@franken/critique';
import type {
  Reviewer,
  GuardrailsPort,
  MemoryPort,
  ObservabilityPort,
  EvaluationInput,
  LoopConfig,
} from '@franken/critique';

// MOD-07: Governor
import {
  GovernorCritiqueAdapter,
  GovernorAuditRecorder,
  BudgetTrigger,
  SkillTrigger,
} from '@franken/governor';
import type { ApprovalChannel, GovernorMemoryPort } from '@franken/governor';

// MOD-08: Heartbeat
import { PulseOrchestrator } from 'franken-heartbeat';
import type { PulseOrchestratorDeps, HeartbeatConfig } from 'franken-heartbeat';

// Stubs
import {
  makeAdapter,
  makeGuardrailsConfig,
  makeGuardrailsPort,
  makeMemoryPort,
  makeObservabilityPort,
  makeApprovalChannel,
  makeGovernorMemoryPort,
  makeHeartbeatLlmClient,
  makeHeartbeatMemoryModule,
  makeHeartbeatObservabilityModule,
  makeHeartbeatPlannerModule,
  makeHeartbeatCritiqueModule,
  makeHeartbeatHitlGateway,
  makeUnifiedRequest,
} from './stubs.js';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface TestBeastOverrides {
  adapter?: IAdapter;
  config?: GuardrailsConfig;
  guardrailsPort?: GuardrailsPort;
  memoryPort?: MemoryPort;
  observabilityPort?: ObservabilityPort;
  approvalChannel?: ApprovalChannel;
  governorMemoryPort?: GovernorMemoryPort;
  heartbeatDeps?: Partial<PulseOrchestratorDeps>;
}

export interface TestBeast {
  /** Run the firewall pipeline on raw input */
  ingest(request: UnifiedRequest): Promise<PipelineResult>;
  /** Run critique on content */
  critique(content: string, loopConfig?: LoopConfig): ReturnType<Reviewer['review']>;
  /** Run heartbeat pulse */
  pulse(): ReturnType<PulseOrchestrator['run']>;

  // Exposed for assertions
  adapter: IAdapter;
  config: GuardrailsConfig;
  reviewer: Reviewer;
  governor: GovernorCritiqueAdapter;
  heartbeat: PulseOrchestrator;
  approvalChannel: ApprovalChannel;
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createTestBeast(overrides: TestBeastOverrides = {}): TestBeast {
  // MOD-01: Firewall
  const adapter = overrides.adapter ?? makeAdapter();
  const config = overrides.config ?? makeGuardrailsConfig();

  // MOD-06: Critique
  const guardrailsPort = overrides.guardrailsPort ?? makeGuardrailsPort();
  const memoryPort = overrides.memoryPort ?? makeMemoryPort();
  const observabilityPort = overrides.observabilityPort ?? makeObservabilityPort();

  const reviewer = createReviewer({
    guardrails: guardrailsPort,
    memory: memoryPort,
    observability: observabilityPort,
    knownPackages: ['express', 'zod', 'vitest', 'typescript'],
  });

  // MOD-07: Governor
  const approvalChannel = overrides.approvalChannel ?? makeApprovalChannel();
  const governorMemoryPort = overrides.governorMemoryPort ?? makeGovernorMemoryPort();
  const auditRecorder = new GovernorAuditRecorder(governorMemoryPort);

  const governor = new GovernorCritiqueAdapter({
    channel: approvalChannel,
    auditRecorder,
    evaluators: [
      new BudgetTrigger(),
      new SkillTrigger(),
    ],
    projectId: 'test-project',
  });

  // MOD-08: Heartbeat
  const heartbeatConfig: HeartbeatConfig = {
    heartbeatFilePath: '/tmp/test-HEARTBEAT.md',
    deepReviewHour: 2,
    tokenSpendAlertThreshold: 5.0,
    maxReflectionTokens: 4096,
  };

  const heartbeat = new PulseOrchestrator({
    memory: makeHeartbeatMemoryModule(),
    observability: makeHeartbeatObservabilityModule(),
    planner: makeHeartbeatPlannerModule(),
    critique: makeHeartbeatCritiqueModule(),
    hitl: makeHeartbeatHitlGateway(),
    llm: makeHeartbeatLlmClient(JSON.stringify({
      improvements: [],
      techDebt: [],
      summary: 'No issues found',
    })),
    gitStatusExecutor: vi.fn(async () => ({ dirty: false, branch: 'main', files: [] })),
    clock: () => new Date('2025-01-15T10:00:00Z'),
    config: heartbeatConfig,
    readFile: vi.fn(async () => '## Active Watchlist\n\n## Reflections\n'),
    writeFile: vi.fn(async () => {}),
    projectId: 'test-project',
    ...overrides.heartbeatDeps,
  });

  return {
    async ingest(request: UnifiedRequest) {
      return runPipeline(request, adapter, config);
    },
    critique(content: string, loopConfig?: LoopConfig) {
      const input: EvaluationInput = {
        content,
        source: 'test',
        metadata: { projectId: 'test-project' },
      };
      const cfg: LoopConfig = loopConfig ?? {
        maxIterations: 3,
        tokenBudget: 100_000,
        consensusThreshold: 3,
        sessionId: 'session-001',
        taskId: 'task-001',
      };
      return reviewer.review(input, cfg);
    },
    async pulse() {
      return heartbeat.run();
    },

    adapter,
    config,
    reviewer,
    governor,
    heartbeat,
    approvalChannel,
  };
}
