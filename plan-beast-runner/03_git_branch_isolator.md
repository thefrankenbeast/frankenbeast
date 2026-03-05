# Chunk 03: GitBranchIsolator + Tests

## Objective

Implement the GitBranchIsolator class — manages per-chunk git branch isolation: create branch from base, auto-commit dirty files after each iteration, and merge back to base branch. TDD: write tests first.

## Files

- Create: `franken-orchestrator/tests/unit/skills/git-branch-isolator.test.ts`
- Create: `franken-orchestrator/src/skills/git-branch-isolator.ts`
- Read (context): `franken-orchestrator/src/skills/cli-types.ts` (from chunk 01)
- Read (context): `plan-2026-03-05/build-runner.ts` lines 424-443 (autoCommitIfDirty), lines 743-751 (branch creation), lines 832-855 (merge)

## Context (read these first)

- `franken-orchestrator/src/skills/cli-types.ts` — GitIsolationConfig type
- `plan-2026-03-05/build-runner.ts` — reference git operations

## Success Criteria

- [ ] Test file exists with at least 6 test cases covering: branch creation from base, branch already exists (checkout), auto-commit dirty files, auto-commit with clean working tree (no-op), merge back to base, merge conflict handling
- [ ] Tests are written FIRST and fail before implementation
- [ ] `GitBranchIsolator` class with constructor taking `config: GitIsolationConfig`
- [ ] `isolate(chunkId: string): void` — creates branch `{branchPrefix}{chunkId}` from `baseBranch`, checks it out
- [ ] `autoCommit(chunkId: string, stage: string, iteration: number): boolean` — `git add -A && git commit` if dirty, returns whether committed
- [ ] `merge(chunkId: string): { merged: boolean; commits: number }` — checks out baseBranch, merges chunk branch, returns commit count
- [ ] `hasMeaningfulChange(previousHead: string): boolean` — dirty files OR new commits since previousHead
- [ ] `getCurrentHead(): string` — returns `git rev-parse HEAD`
- [ ] All git commands executed via `execSync` with `cwd` from config
- [ ] All tests pass

## Verification Command

```bash
cd franken-orchestrator && npx vitest run tests/unit/skills/git-branch-isolator.test.ts
```

## Hardening Requirements

- Mock `child_process.execSync` in tests — do NOT actually run git commands
- Use `vi.mock('node:child_process')` for execSync mocking
- `merge()` must abort on conflict (`git merge --abort`) and return `merged: false`
- `merge()` must check `git rev-list --count base..branch > 0` before merging (skip empty branches)
- `autoCommit()` must handle commit failure gracefully (return false, don't throw)
- Commit messages follow pattern: `"auto: {stage} {chunkId} iter {iteration}"`
- Do NOT import from `@frankenbeast/observer` — observer is wired by CliSkillExecutor (chunk 04)
- All string arguments to git commands must be shell-safe (no injection via chunkId)
