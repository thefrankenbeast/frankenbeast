# Chunk 05: Execution Phase Wiring + Tests

## Objective

Wire the CliSkillExecutor into the existing `executeTask()` skill dispatch loop in `execution.ts`. When a task's `requiredSkills` includes a skill with `executionType: 'cli'`, route execution through the `CliSkillExecutor` instead of the default `skills.execute()`. TDD: write tests first.

## Files

- Modify: `franken-orchestrator/src/phases/execution.ts`
- Modify: `franken-orchestrator/tests/unit/phases/execution.test.ts`
- Modify: `franken-orchestrator/tests/helpers/stubs.ts`
- Read (context): `franken-orchestrator/src/skills/cli-skill-executor.ts` (chunk 04)
- Read (context): `franken-orchestrator/src/deps.ts` — SkillDescriptor, ISkillsModule

## Context (read these first)

- `franken-orchestrator/src/phases/execution.ts` — the `executeTask()` function, especially lines 214-228 (skill dispatch loop) and the `runExecution()` signature (lines 31-39)
- `franken-orchestrator/tests/unit/phases/execution.test.ts` — existing test patterns
- `franken-orchestrator/tests/helpers/stubs.ts` — `makeSkills()`, `makeDeps()` factory functions

## Success Criteria

- [ ] New tests added to `execution.test.ts` covering: task with `executionType: 'cli'` routes through CliSkillExecutor, task with `executionType: 'llm'` still routes through `skills.execute()` (regression), mixed tasks with both cli and llm skills in same plan
- [ ] Tests are written FIRST and fail before implementation
- [ ] `runExecution()` signature extended with optional `cliExecutor?: CliSkillExecutor` parameter (after `mcp?`)
- [ ] Inside `executeTask()`, the skill dispatch loop (line 214-228) now checks `executionType` of the skill via `skills.getAvailableSkills()` before dispatching
- [ ] If `executionType === 'cli'`: calls `cliExecutor.execute(skillId, baseInput, cliConfig)` instead of `skills.execute(skillId, baseInput)`
- [ ] If `executionType !== 'cli'`: calls `skills.execute(skillId, baseInput)` as before (no change to existing path)
- [ ] `stubs.ts` updated: `makeSkills()` default `getAvailableSkills` includes a cli skill descriptor when testing cli paths
- [ ] All existing execution tests still pass (no regressions)
- [ ] All new tests pass

## Verification Command

```bash
cd franken-orchestrator && npx vitest run tests/unit/phases/execution.test.ts
```

## Hardening Requirements

- The `cliExecutor` parameter MUST be optional — all existing callers pass nothing and behavior is unchanged
- If a skill has `executionType: 'cli'` but no `cliExecutor` was provided, throw a clear error: `"CLI skill '{skillId}' requires a CliSkillExecutor but none was provided"`
- Do NOT change the `ISkillsModule` interface — routing is done at the execution phase level, not the skills port
- The `getAvailableSkills()` lookup for executionType must handle the case where the skill is not found in the available skills list (fall through to default `skills.execute()`)
- Do NOT modify the HITL check logic — cli skills should still respect `requiresHitl` on their SkillDescriptor
- Keep the dependency threading (dependencyOutputs map) working for cli skills — pass the same `baseInput` with `dependencyOutputs` from completed tasks
