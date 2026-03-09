# ADR-012: Multi-Pass Planner Pipeline

- **Date:** 2026-03-09
- **Status:** Accepted
- **Deciders:** David Mendez

## Context

The `LlmGraphBuilder` produced thin, outline-level chunks via a single LLM call that saw only the design document text — no codebase awareness. This led to:

1. **Missing components** — the design doc assumed infrastructure that didn't exist (e.g., a cheap LLM client, an HTTP framework dependency) and no chunk created it
2. **False dependency chains** — chunks were serialized linearly when many could run in parallel
3. **Thin chunks** — chunks contained only objective, files, and a one-line success criteria, forcing the executing agent to guess at interfaces, edge cases, and design decisions
4. **No quality validation** — the only checks were structural (required fields present, no cycles)

The chatbot implementation plan demonstrated all four problems: 12 chunks were produced that were outlines, not execution plans.

## Decision

Replace the single-call decomposition with a multi-pass, codebase-aware pipeline:

```
design doc → context gathering → decomposition → validation → (remediation) → chunk files
```

### Components

| Component | Responsibility | LLM calls |
|-----------|---------------|-----------|
| `PlanContextGatherer` | Collects RAMP_UP.md, file signatures, package deps from filesystem | 0 |
| `ChunkDecomposer` | Design doc + codebase context → ChunkDefinition[] | 1 |
| `ChunkValidator` | Validates chunk quality, finds gaps and issues | 1 |
| `ChunkRemediator` | Patches chunks based on validation issues | 1 (conditional) |
| `ChunkFileWriter` | Writes expanded .md chunk files with optional warnings | 0 |

### Expanded chunk schema

`ChunkDefinition` grows from 6 fields to 11 (5 new optional fields):
- `context` — what the agent needs to know about existing code
- `designDecisions` — key choices with rationale
- `interfaceContract` — public API (TypeScript signatures)
- `edgeCases` — specific scenarios the implementation must handle
- `antiPatterns` — what NOT to do

### Hard caps

- Maximum 4 LLM calls total (decompose + validate + remediate + re-validate)
- Typical case is 2 (decompose + validate)
- Maximum 1 remediation attempt — no infinite loops
- Unresolved issues after remediation become warnings attached to chunk files

### Backward compatibility

- `LlmGraphBuilder(llm)` still works (no contextGatherer = no validation, legacy behavior)
- `skipValidation: true` option for speed over quality
- Old 6-field chunk files still work with `ChunkFileGraphBuilder`

## Consequences

### Positive

- Chunks include interface contracts, edge cases, and anti-patterns — agents can execute without guessing
- Missing components (new dependencies, infrastructure) are detected before execution begins
- False serialization is identified, enabling parallel execution
- Validation warnings are visible to both HITM reviewers and executing agents
- Pipeline is modular — each pass can be tested and improved independently

### Negative

- Planning phase uses 2-4x more LLM tokens (2-4 calls vs 1)
- Planning takes longer (sequential LLM calls for validation/remediation)
- More code to maintain (5 new files)

### Risks

- Context gathering heuristics (file path detection, signature extraction) may miss relevant files or include irrelevant ones
- Validation prompt quality directly affects issue detection — false positives could waste a remediation pass
- The hard cap of 1 remediation attempt means some issues may persist as warnings

## Alternatives Considered

| Option | Pros | Cons | Rejected Because |
|--------|------|------|-----------------|
| A: Prompt-only (single enriched prompt) | Simple, 1 LLM call | No validation, still single-pass | Doesn't solve missing component detection |
| B: Multi-pass pipeline (chosen) | Validates + remediates, codebase-aware | More LLM calls, more code | Best balance of quality and complexity |
| C: Human-in-the-loop validation | Most accurate validation | Blocks on human, slow | Pipeline should be autonomous; HITM review already exists downstream |
