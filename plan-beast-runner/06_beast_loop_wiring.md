# Chunk 06: BeastLoop Wiring + Exports

## Objective

Wire CliSkillExecutor through BeastLoopDeps into the BeastLoop.run() pipeline. Update public exports from index.ts. Update test helpers.

## Files

- Modify: `franken-orchestrator/src/deps.ts`
- Modify: `franken-orchestrator/src/beast-loop.ts`
- Modify: `franken-orchestrator/src/index.ts`
- Modify: `franken-orchestrator/tests/helpers/stubs.ts`
- Modify: `franken-orchestrator/tests/unit/beast-loop.test.ts`
- Read (context): `franken-orchestrator/src/skills/cli-skill-executor.ts` (chunk 04)
- Read (context): `franken-orchestrator/src/phases/execution.ts` (chunk 05 changes)

## Context (read these first)

- `franken-orchestrator/src/deps.ts` — BeastLoopDeps at line 182-194, `mcp?` is the optional dep precedent
- `franken-orchestrator/src/beast-loop.ts` — BeastLoop.run() at line 30-132, `this.deps.mcp` forwarded at line 70
- `franken-orchestrator/src/index.ts` — existing exports, LlmSkillHandler export at line 62
- `franken-orchestrator/tests/helpers/stubs.ts` — `makeDeps()` factory

## Success Criteria

- [ ] `BeastLoopDeps` extended with `readonly cliExecutor?: CliSkillExecutor` (follows `mcp?` pattern)
- [ ] `BeastLoop.run()` forwards `this.deps.cliExecutor` to `runExecution()` call
- [ ] `index.ts` exports: `CliSkillExecutor`, `RalphLoop`, `GitBranchIsolator`, all types from `cli-types.ts`
- [ ] `stubs.ts` `makeDeps()` does NOT include `cliExecutor` by default (optional, just like `mcp`)
- [ ] New test in `beast-loop.test.ts`: BeastLoop forwards cliExecutor dep to runExecution
- [ ] All existing beast-loop tests still pass
- [ ] `npx tsc --noEmit` passes cleanly

## Verification Command

```bash
cd franken-orchestrator && npx vitest run tests/unit/beast-loop.test.ts && npx tsc --noEmit
```

## Hardening Requirements

- `cliExecutor` is optional in BeastLoopDeps — follow the exact `mcp?` pattern (line 192)
- Do NOT make cliExecutor required — it breaks all existing tests and consumers
- Export types as `export type { ... }` for interfaces, `export { ... }` for classes
- The `.js` extension must be used in all import paths (NodeNext module resolution)
- Do NOT re-export observer types — consumers import those from `@frankenbeast/observer` directly
- Keep `makeDeps()` backward-compatible — existing tests that don't pass `cliExecutor` must still work
