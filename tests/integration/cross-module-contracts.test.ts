/**
 * Cross-Module Contract Verification
 *
 * Structural tests ensuring port interfaces are satisfied across modules.
 * These tests verify that the types align at compile-time and that
 * runtime objects have the correct shape.
 */

import { describe, it, expect, expectTypeOf, vi } from 'vitest';

// MOD-01: Firewall
import { runPipeline } from '@franken/firewall';
import type { IAdapter } from '@franken/firewall';

// MOD-03: Brain / Memory
import {
  MemoryOrchestrator,
  WorkingMemoryStore,
  TruncationStrategy,
  TokenBudget,
} from 'franken-brain';
import type { ILlmClient } from 'franken-brain';

// MOD-04: Planner
import type {
  GuardrailsModule,
  SkillsModule,
  MemoryModule,
  SelfCritiqueModule,
} from 'franken-planner';

// MOD-06: Critique
import { createReviewer } from '@franken/critique';
import type {
  GuardrailsPort,
  MemoryPort,
  ObservabilityPort,
  EscalationPort,
} from '@franken/critique';

// MOD-07: Governor
import { GovernorCritiqueAdapter, GovernorAuditRecorder } from '@franken/governor';
import type { GovernorMemoryPort, ApprovalChannel } from '@franken/governor';

// MOD-08: Heartbeat
import type {
  IMemoryModule as HeartbeatMemoryModule,
  IObservabilityModule as HeartbeatObservabilityModule,
  IPlannerModule,
  ICritiqueModule,
  IHitlGateway,
} from 'franken-heartbeat';

// ─── Contract Tests ─────────────────────────────────────────────────────────

describe('Contract: MOD-06 port interfaces', () => {
  it('GuardrailsPort shape has getSafetyRules and executeSandbox', () => {
    const port: GuardrailsPort = {
      getSafetyRules: vi.fn(async () => []),
      executeSandbox: vi.fn(async () => ({
        success: true,
        output: '',
        exitCode: 0,
        timedOut: false,
      })),
    };

    expect(port.getSafetyRules).toBeDefined();
    expect(port.executeSandbox).toBeDefined();
  });

  it('MemoryPort shape has searchADRs, searchEpisodic, recordLesson', () => {
    const port: MemoryPort = {
      searchADRs: vi.fn(async () => []),
      searchEpisodic: vi.fn(async () => []),
      recordLesson: vi.fn(async () => {}),
    };

    expect(port.searchADRs).toBeDefined();
    expect(port.searchEpisodic).toBeDefined();
    expect(port.recordLesson).toBeDefined();
  });

  it('ObservabilityPort shape has getTokenSpend', () => {
    const port: ObservabilityPort = {
      getTokenSpend: vi.fn(async () => ({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      })),
    };

    expect(port.getTokenSpend).toBeDefined();
  });

  it('EscalationPort shape has requestHumanReview', () => {
    const port: EscalationPort = {
      requestHumanReview: vi.fn(async () => {}),
    };

    expect(port.requestHumanReview).toBeDefined();
  });
});

describe('Contract: MOD-04 module interfaces', () => {
  it('GuardrailsModule shape has getSanitizedIntent', () => {
    const mod: GuardrailsModule = {
      getSanitizedIntent: vi.fn(async () => ({
        goal: 'test',
        strategy: 'linear' as const,
      })),
    };

    expect(mod.getSanitizedIntent).toBeDefined();
  });

  it('SkillsModule shape has getAvailableSkills and hasSkill', () => {
    const mod: SkillsModule = {
      getAvailableSkills: vi.fn(async () => []),
      hasSkill: vi.fn(async () => false),
    };

    expect(mod.getAvailableSkills).toBeDefined();
    expect(mod.hasSkill).toBeDefined();
  });

  it('MemoryModule shape has getADRs, getKnownErrors, getProjectContext', () => {
    const mod: MemoryModule = {
      getADRs: vi.fn(async () => []),
      getKnownErrors: vi.fn(async () => []),
      getProjectContext: vi.fn(async () => ({
        projectName: 'test',
        adrs: [],
        rules: [],
      })),
    };

    expect(mod.getADRs).toBeDefined();
    expect(mod.getKnownErrors).toBeDefined();
    expect(mod.getProjectContext).toBeDefined();
  });

  it('SelfCritiqueModule shape has verifyRationale', () => {
    const mod: SelfCritiqueModule = {
      verifyRationale: vi.fn(async () => ({ verdict: 'approved' as const })),
    };

    expect(mod.verifyRationale).toBeDefined();
  });
});

describe('Contract: MOD-07 port interfaces', () => {
  it('GovernorMemoryPort shape has recordDecision', () => {
    const port: GovernorMemoryPort = {
      recordDecision: vi.fn(async () => {}),
    };

    expect(port.recordDecision).toBeDefined();
  });

  it('ApprovalChannel shape has channelId and requestApproval', () => {
    const channel: ApprovalChannel = {
      channelId: 'test',
      requestApproval: vi.fn(async () => ({
        requestId: 'req-001',
        decision: 'APPROVE' as const,
        respondedBy: 'human',
        respondedAt: new Date(),
      })),
    };

    expect(channel.channelId).toBeDefined();
    expect(channel.requestApproval).toBeDefined();
  });
});

describe('Contract: MOD-08 module interfaces', () => {
  it('IMemoryModule shape for heartbeat', () => {
    const mod: HeartbeatMemoryModule = {
      getRecentTraces: vi.fn(async () => []),
      getSuccesses: vi.fn(async () => []),
      getFailures: vi.fn(async () => []),
      recordLesson: vi.fn(async () => {}),
    };

    expect(mod.getRecentTraces).toBeDefined();
    expect(mod.getSuccesses).toBeDefined();
    expect(mod.getFailures).toBeDefined();
    expect(mod.recordLesson).toBeDefined();
  });

  it('IObservabilityModule shape for heartbeat', () => {
    const mod: HeartbeatObservabilityModule = {
      getTraces: vi.fn(async () => []),
      getTokenSpend: vi.fn(async () => ({
        totalTokens: 0,
        totalCostUsd: 0,
        breakdown: [],
      })),
    };

    expect(mod.getTraces).toBeDefined();
    expect(mod.getTokenSpend).toBeDefined();
  });

  it('IPlannerModule shape for heartbeat', () => {
    const mod: IPlannerModule = {
      injectTask: vi.fn(async () => {}),
    };

    expect(mod.injectTask).toBeDefined();
  });

  it('ICritiqueModule shape for heartbeat', () => {
    const mod: ICritiqueModule = {
      auditConclusions: vi.fn(async () => ({
        passed: true,
        reason: 'ok',
        flaggedItems: [],
      })),
    };

    expect(mod.auditConclusions).toBeDefined();
  });

  it('IHitlGateway shape for heartbeat', () => {
    const gateway: IHitlGateway = {
      sendMorningBrief: vi.fn(async () => {}),
      notifyAlert: vi.fn(async () => {}),
    };

    expect(gateway.sendMorningBrief).toBeDefined();
    expect(gateway.notifyAlert).toBeDefined();
  });
});

describe('Contract: MOD-03 Brain — ILlmClient', () => {
  it('ILlmClient shape has complete method', () => {
    const client: ILlmClient = {
      complete: vi.fn(async () => 'response'),
    };

    expect(client.complete).toBeDefined();
  });
});

describe('Contract: Module composition wires correctly', () => {
  it('createReviewer accepts port implementations', () => {
    const reviewer = createReviewer({
      guardrails: {
        getSafetyRules: vi.fn(async () => []),
        executeSandbox: vi.fn(async () => ({
          success: true,
          output: '',
          exitCode: 0,
          timedOut: false,
        })),
      },
      memory: {
        searchADRs: vi.fn(async () => []),
        searchEpisodic: vi.fn(async () => []),
        recordLesson: vi.fn(async () => {}),
      },
      observability: {
        getTokenSpend: vi.fn(async () => ({
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        })),
      },
      knownPackages: [],
    });

    expect(reviewer).toBeDefined();
    expect(reviewer.review).toBeInstanceOf(Function);
  });

  it('GovernorCritiqueAdapter structurally satisfies SelfCritiqueModule', () => {
    // GovernorCritiqueAdapter has a verifyRationale method matching SelfCritiqueModule
    expectTypeOf<GovernorCritiqueAdapter>().toHaveProperty('verifyRationale');
    expectTypeOf<GovernorCritiqueAdapter['verifyRationale']>().toBeFunction();
  });

  it('GovernorCritiqueAdapter accepts port implementations', () => {
    const adapter = new GovernorCritiqueAdapter({
      channel: {
        channelId: 'test',
        requestApproval: vi.fn(async (req) => ({
          requestId: req.requestId,
          decision: 'APPROVE' as const,
          respondedBy: 'human',
          respondedAt: new Date(),
        })),
      },
      auditRecorder: new GovernorAuditRecorder({
        recordDecision: vi.fn(async () => {}),
      }),
      evaluators: [],
      projectId: 'test',
    });

    expect(adapter).toBeDefined();
    expect(adapter.verifyRationale).toBeInstanceOf(Function);
  });
});
