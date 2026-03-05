/**
 * Phase 4: Observability & Closure
 *
 * Tests MOD-08 (Heartbeat) working with mock module interfaces.
 * The heartbeat runs a cheap deterministic check, then optionally
 * an expensive LLM reflection, and dispatches actions.
 */

import { describe, it, expect, vi } from 'vitest';

import { PulseOrchestrator } from 'franken-heartbeat';
import type { HeartbeatConfig, PulseOrchestratorDeps } from 'franken-heartbeat';

import {
  makeHeartbeatLlmClient,
  makeHeartbeatMemoryModule,
  makeHeartbeatObservabilityModule,
  makeHeartbeatPlannerModule,
  makeHeartbeatCritiqueModule,
  makeHeartbeatHitlGateway,
} from '../helpers/stubs.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function buildOrchestrator(opts: {
  checklistContent?: string;
  llmResponse?: string;
  auditPassed?: boolean;
  clock?: () => Date;
} = {}): {
  orchestrator: PulseOrchestrator;
  hitl: ReturnType<typeof makeHeartbeatHitlGateway>;
  planner: ReturnType<typeof makeHeartbeatPlannerModule>;
  llm: ReturnType<typeof makeHeartbeatLlmClient>;
} {
  const hitl = makeHeartbeatHitlGateway();
  const planner = makeHeartbeatPlannerModule();
  const llm = makeHeartbeatLlmClient(
    opts.llmResponse ??
      JSON.stringify({
        improvements: [{ description: 'Add error handling', priority: 'medium' }],
        techDebt: [],
        summary: 'Found one improvement',
      }),
  );

  const config: HeartbeatConfig = {
    heartbeatFilePath: '/tmp/test-HEARTBEAT.md',
    deepReviewHour: 2,
    tokenSpendAlertThreshold: 5.0,
    maxReflectionTokens: 4096,
  };

  const deps: PulseOrchestratorDeps = {
    memory: makeHeartbeatMemoryModule(),
    observability: makeHeartbeatObservabilityModule(),
    planner,
    critique: makeHeartbeatCritiqueModule(opts.auditPassed ?? true),
    hitl,
    llm,
    gitStatusExecutor: vi.fn(async () => ({ dirty: false, branch: 'main', files: [] })),
    clock: opts.clock ?? (() => new Date('2025-01-15T10:00:00Z')),
    config,
    readFile: vi.fn(async () => opts.checklistContent ?? '## Active Watchlist\n\n## Reflections\n'),
    writeFile: vi.fn(async () => {}),
    projectId: 'test-project',
  };

  const orchestrator = new PulseOrchestrator(deps);
  return { orchestrator, hitl, planner, llm };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Phase 4: Closure — Heartbeat Pulse', () => {
  it('takes the cheap path when no flags are detected (zero LLM cost)', async () => {
    const { orchestrator, llm } = buildOrchestrator({
      checklistContent: '## Active Watchlist\n\n## Reflections\n',
    });

    const report = await orchestrator.run();

    expect(report.pulseResult.status).toBe('HEARTBEAT_OK');
    expect(report.actions).toEqual([]);
    // LLM should NOT have been called — cheap path only
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('runs reflection when flags are detected', async () => {
    const { orchestrator, llm } = buildOrchestrator({
      checklistContent: '## Active Watchlist\n- [ ] Fix memory leak in worker\n\n## Reflections\n',
    });

    const report = await orchestrator.run();

    expect(report.pulseResult.status).toBe('FLAGS_FOUND');
    // LLM should have been called for reflection
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch actions when audit rejects reflection', async () => {
    const { orchestrator, hitl } = buildOrchestrator({
      checklistContent: '## Active Watchlist\n- [ ] Pending task\n\n## Reflections\n',
      auditPassed: false,
    });

    const report = await orchestrator.run();

    expect(report.actions).toEqual([]);
    // Morning brief should NOT be sent
    expect(hitl.sendMorningBrief).not.toHaveBeenCalled();
  });
});
