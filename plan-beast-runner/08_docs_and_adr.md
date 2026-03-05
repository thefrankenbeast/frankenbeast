# Chunk 08: Documentation + ADR

## Objective

Update ARCHITECTURE.md with the CLI skill execution path and write an ADR for the design decision. Final cleanup and verification that all tests pass.

## Files

- Modify: `docs/ARCHITECTURE.md`
- Create: `docs/adr/NNN-cli-skill-execution-type.md` (use next available number)
- Read (context): `docs/adr/` — check existing ADR numbers to pick the next one
- Read (context): `docs/ARCHITECTURE.md` — find the right section to add CLI execution path

## Context (read these first)

- `docs/ARCHITECTURE.md` — the existing architecture doc, find where skill execution is documented
- `docs/adr/` — existing ADRs, determine the next number
- `docs/plans/2026-03-05-beast-runner-design.md` — the design doc with all decisions

## Success Criteria

- [ ] `ARCHITECTURE.md` updated with a new section or subsection documenting the CLI skill execution path: CliSkillExecutor → RalphLoop → GitBranchIsolator → observer tracing
- [ ] Architecture section includes a Mermaid sequence diagram showing the flow: BeastLoop → executeTask → CliSkillExecutor → RalphLoop.run() → spawn CLI → promise detection → GitBranchIsolator.merge()
- [ ] ADR created with: Title, Status (Accepted), Context (why CLI skill type was needed), Decision (absorb build runner into orchestrator as executionType: 'cli'), Consequences (positive: reuses observer/planner infrastructure; negative: couples CLI tool availability to orchestrator)
- [ ] Full test suite passes: `cd franken-orchestrator && npx vitest run`
- [ ] TypeScript compiles: `cd franken-orchestrator && npx tsc --noEmit`

## Verification Command

```bash
cd franken-orchestrator && npx vitest run && npx tsc --noEmit
```

## Hardening Requirements

- Do NOT remove or significantly restructure existing ARCHITECTURE.md content — only ADD the CLI execution section
- ADR must follow the existing format in `docs/adr/` (Title, Status, Context, Decision, Consequences)
- ADR status must be "Accepted"
- Mermaid diagram must be valid — test it renders correctly
- Do NOT document Approach C (future) in the ADR — it's a separate decision
- Reference the design doc: `docs/plans/2026-03-05-beast-runner-design.md`
