# ADR-013: Expanded Chunk Definition Schema

- **Date:** 2026-03-09
- **Status:** Accepted
- **Deciders:** David Mendez

## Context

The original `ChunkDefinition` had 6 fields: `id`, `objective`, `files`, `successCriteria`, `verificationCommand`, `dependencies`. This was sufficient for structural decomposition but left executing agents without critical information:

- No interface signatures — agents had to guess what APIs to expose
- No edge cases — happy-path-only implementations that broke under real conditions
- No design context — agents didn't know what existing code they were touching or why
- No anti-patterns — agents repeated mistakes that codebase conventions were designed to prevent

Additionally, the type was duplicated: an exported version in `file-writer.ts` and a private version in `llm-graph-builder.ts`.

## Decision

Expand `ChunkDefinition` to 11 fields by adding 5 optional fields, and consolidate to a single canonical location (`file-writer.ts`):

```ts
interface ChunkDefinition {
  // Original 6 (required)
  id: string;
  objective: string;
  files: string[];
  successCriteria: string;
  verificationCommand: string;
  dependencies: string[];

  // New 5 (optional)
  context?: string;           // Existing code context the agent needs
  designDecisions?: string;   // Key choices with rationale
  interfaceContract?: string; // Public API (TypeScript signatures)
  edgeCases?: string;         // Scenarios the implementation must handle
  antiPatterns?: string;      // What NOT to do
}
```

New fields are optional so that:
- Hand-written chunks (6-field format) continue working
- `ChunkFileGraphBuilder` doesn't break on old chunk files
- Incremental adoption — the LLM decomposer aims for all 11 but tolerates omissions

The chunk markdown file format includes sections for all present fields, omitting sections for undefined optional fields.

Chunk IDs use action-verb kebab-case convention (e.g., `define-types`, `implement-router`, `wire-dependency`).

## Consequences

### Positive

- Executing agents have complete context — interface contracts, edge cases, design rationale
- Anti-patterns prevent common mistakes specific to the codebase
- Single canonical type eliminates drift between duplicated definitions
- Optional fields maintain backward compatibility

### Negative

- Larger chunk files (more sections to read)
- LLM must produce more structured output per chunk
- More fields to validate

### Risks

- LLM may produce vague or generic content for new fields (mitigated by validation pass in ADR-012)

## Alternatives Considered

| Option | Pros | Cons | Rejected Because |
|--------|------|------|-----------------|
| Keep 6 fields, improve prompts only | No schema change | Agents still guess | Doesn't solve the information gap |
| Make all 11 fields required | Stronger guarantees | Breaks backward compat, hand-written chunks | Too rigid for incremental adoption |
| Separate "rich chunk" type | Clean separation | Two types to manage, conversion logic | Unnecessary complexity when optional fields suffice |
