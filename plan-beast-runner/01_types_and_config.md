# Chunk 01: Types & Config Interfaces

## Objective

Extend `SkillDescriptor.executionType` with `'cli'` and define the configuration/result types needed by all subsequent chunks. Foundation-only — no implementation logic.

## Files

- Modify: `franken-orchestrator/src/deps.ts`
- Create: `franken-orchestrator/src/skills/cli-types.ts`

## Context (read these first)

- `franken-orchestrator/src/deps.ts` — existing SkillDescriptor type at line 40-45
- `franken-orchestrator/src/skills/llm-skill-handler.ts` — structural precedent (line 4 for LlmSkillResult)

## Success Criteria

- [ ] `SkillDescriptor.executionType` union extended from `'llm' | 'function' | 'mcp'` to `'llm' | 'function' | 'mcp' | 'cli'`
- [ ] New file `cli-types.ts` exports `RalphLoopConfig` interface: `prompt` (string), `promiseTag` (string), `maxIterations` (number), `maxTurns` (number), `provider` (`'claude' | 'codex'`), `claudeCmd` (string, default `'claude'`), `codexCmd` (string, default `'codex'`), `timeoutMs` (number)
- [ ] `cli-types.ts` exports `RalphLoopResult` interface: `completed` (boolean), `iterations` (number), `output` (string), `tokensUsed` (number)
- [ ] `cli-types.ts` exports `GitIsolationConfig` interface: `baseBranch` (string), `branchPrefix` (string, default `'feat/'`), `autoCommit` (boolean), `workingDir` (string)
- [ ] `cli-types.ts` exports `CliSkillConfig` interface: `ralph` (RalphLoopConfig), `git` (GitIsolationConfig), `budgetLimitUsd` (number, optional)
- [ ] All properties are `readonly`
- [ ] TypeScript compiles cleanly

## Verification Command

```bash
cd franken-orchestrator && npx tsc --noEmit
```

## Hardening Requirements

- Only add `'cli'` to the existing union — do not change any other values
- All new types go in `cli-types.ts`, not in `deps.ts` (keep deps.ts focused on port interfaces)
- Use `readonly` on every property
- No implementation code — types and interfaces only
- Do not add runtime dependencies
- Import path must use `.js` extension: `import type { ... } from './cli-types.js'`
