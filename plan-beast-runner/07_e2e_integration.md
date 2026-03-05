# Chunk 07: E2E Integration Test

## Objective

Write an end-to-end integration test that proves a single chunk file can flow through BeastLoop → execution phase → CliSkillExecutor → RalphLoop (with mocked CLI spawn) → GitBranchIsolator (with mocked git) → observer tracing → SkillResult. This is the Approach A tracer bullet.

## Files

- Create: `franken-orchestrator/tests/e2e/cli-skill-execution.test.ts`
- Read (context): `franken-orchestrator/tests/e2e/happy-path.test.ts` — E2E test pattern
- Read (context): `franken-orchestrator/tests/helpers/test-orchestrator-factory.ts` — factory pattern
- Read (context): `franken-orchestrator/tests/helpers/in-memory-ports.ts` — stateful mocks

## Context (read these first)

- `franken-orchestrator/tests/e2e/happy-path.test.ts` — the E2E test pattern: uses `createTestOrchestrator()`, asserts on `result.status`, `result.taskResults`, `ports.*`
- `franken-orchestrator/tests/helpers/test-orchestrator-factory.ts` — how the factory wires BeastLoopDeps
- All source files from chunks 01-06

## Success Criteria

- [ ] Test file guarded with `describe.skipIf(!process.env['E2E'])` to only run with `E2E=true`
- [ ] Test creates a BeastLoop with a mock planner that returns a 1-task PlanGraph with `requiredSkills: ['cli:test-chunk']`
- [ ] The mock planner's task has `executionType: 'cli'` in its skill descriptor
- [ ] RalphLoop is configured with a mock spawn that returns stdout containing `<promise>IMPL_test-chunk_DONE</promise>` on the first iteration
- [ ] GitBranchIsolator is configured with mock git commands that simulate branch creation and merge
- [ ] Test calls `loop.run({ projectId: 'test', userInput: 'test chunk' })`
- [ ] Asserts: `result.status === 'completed'`
- [ ] Asserts: `result.taskResults` has 1 entry with `status: 'success'`
- [ ] Asserts: token spend is recorded (non-zero `result.tokenSpend.totalTokens`)
- [ ] Test passes with `E2E=true npx vitest run tests/e2e/cli-skill-execution.test.ts`

## Verification Command

```bash
cd franken-orchestrator && E2E=true npx vitest run tests/e2e/cli-skill-execution.test.ts
```

## Hardening Requirements

- Do NOT spawn real Claude or Codex — mock `child_process.spawn` at the test level
- Do NOT run real git commands — mock `child_process.execSync` at the test level
- The test should prove the FULL pipeline works: BeastLoop.run() → ingestion → planning → execution (with cli skill) → closure → BeastResult
- Use the existing `createTestOrchestrator()` factory if possible, extended with `cliExecutor` config
- If the factory doesn't support cliExecutor yet, create the BeastLoop manually with full deps
- The test name should clearly state what it proves: `'single chunk flows through BeastLoop via CliSkillExecutor'`
- This test is the tracer bullet — if it passes, the Approach A architecture is proven
