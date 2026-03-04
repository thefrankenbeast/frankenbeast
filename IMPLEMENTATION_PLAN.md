# Frankenbeast — Implementation Plan

## Mission

Frankenbeast is a **deterministic guardrails framework for AI agents**. It exists because LLM-based agents — including headline systems like OpenClaw — routinely lose safety constraints when context windows compress, hallucinate tool calls that violate architectural rules, and take destructive actions without human oversight.

Frankenbeast solves this by enforcing safety **outside** the LLM's context window through deterministic verification at every stage of the agent lifecycle: ingestion, planning, execution, and closure. Every check that *can* be deterministic *is* deterministic. LLM reasoning is only used where it is unavoidable (plan generation, summarisation), and even then it is audited by deterministic critique before being trusted.

### Core Principles

- **Determinism over probabilism.** Regex-based injection scanning, schema validation, dependency whitelisting, DAG cycle detection, HMAC signature verification — these do not hallucinate.
- **LLM-agnostic.** The firewall (MOD-01) is a Model-Agnostic Proxy. Adapters exist for Claude and OpenAI today. Adding any provider means implementing a single `IAdapter` interface. No module hardcodes a provider.
- **Immutable safety constraints.** Guardrails live in the firewall pipeline, not in the LLM prompt. They cannot be compressed, summarised, or forgotten.
- **Human-in-the-loop as a first-class primitive.** High-stakes actions require cryptographically signed human approval via MOD-07 before execution.
- **Full auditability.** Every decision — plan, critique, approval, tool call, failure — is traced, costed, and exportable to OTEL/Langfuse/Prometheus/Tempo.
- **Guardrails as a service.** The firewall and critique modules are designed to wrap *any* agent framework (OpenClaw, custom agents, etc.) as a standalone governance layer.

### Architectural Note: Independent Repos

Each of the 8 modules is its own git repository with independent versioning, CI, and release lifecycle. The orchestrator consumes them as published npm packages. This plan respects that boundary — PRs are scoped to a single repo unless explicitly noted.

---

## Current State

| # | Module | Package | Status | Tests | Key Gap |
|---|--------|---------|--------|-------|---------|
| 01 | frankenfirewall | `@franken/firewall` | ~90% | 18 files | Barrel missing `types`; no adapter integration harness |
| 02 | franken-skills | `@franken/skills` | ~95% | 10 files | Most mature, dist builds clean |
| 03 | franken-brain | `@franken/brain` | ~75% | 1 smoke | Zero domain tests despite full source |
| 04 | franken-planner | `franken-planner` | ~85% | 6 files | `index.ts` only exports `version` |
| 05 | franken-observer | `@frankenbeast/observer` | ~95% | 18+ files | Most complete module |
| 06 | franken-critique | `@franken/critique` | ~80% | 1 integration | No unit tests for evaluators |
| 07 | franken-governor | `@franken/governor` | ~80% | 2 files | No unit tests for triggers/gateway/security |
| 08 | franken-heartbeat | `franken-heartbeat` | ~70% | 1 smoke | Zero domain tests; CLI untested |

Strengths already in place:

- TypeScript strict ESM, dependency injection, port/adapter pattern everywhere
- Cross-module contracts via matching interfaces (no direct imports)
- Vitest + Zod at all system boundaries
- Firewall already has Claude + OpenAI adapters with `IAdapter` interface

---

## Phase 1: Stabilise Individual Modules

Each PR targets a single module repo. All Phase 1 PRs can run in parallel across repos.

### PR-01: franken-brain — Working Memory tests

**Repo:** `franken-brain` **Priority:** HIGH

- Unit tests for `WorkingMemoryStore` — add, prune, compress, token budget enforcement
- Unit tests for `partitionForPruning` — edge cases: empty store, all system turns, budget zero
- Unit tests for `TruncationStrategy` — fits within budget by dropping oldest

Exit: green `vitest run`, these files at 100% coverage.

### PR-02: franken-brain — Compression strategy tests

**Repo:** `franken-brain`

- Unit tests for `LlmSummarisationStrategy` (mock `ILlmClient`, verify fallback to truncation)
- Unit tests for `EpisodicLessonExtractor` (mock LLM, verify structured lesson output)

### PR-03: franken-brain — Episodic & Semantic store tests

**Repo:** `franken-brain`

- Unit tests for `EpisodicMemoryStore` (mock `better-sqlite3`, verify SQL lifecycle)
- Unit tests for `SemanticMemoryStore` (mock `IChromaClient` + `IEmbeddingProvider`)
- Integration test: SQLite episodic round-trip (real `better-sqlite3`, temp DB file)

### PR-04: franken-brain — PII guards & orchestrator tests

**Repo:** `franken-brain`

- Unit tests for `PiiGuardedEpisodicStore` and `PiiGuardedSemanticStore` (mock scanner, verify block/pass)
- Unit tests for `MemoryOrchestrator` — `recordTurn`, `recordToolResult`, `frontload`, `getContext`
- Verify `index.ts` barrel exports the full public API
- Exit: full module at >=80% line coverage

### PR-05: franken-heartbeat — Checklist parser/writer tests

**Repo:** `franken-heartbeat` **Priority:** HIGH

- Unit tests for `parser.ts` — parse fixture HEARTBEAT.md, empty file, malformed sections
- Unit tests for `writer.ts` — round-trip identity: parse -> write -> parse === original
- Unit tests for `DeterministicChecker` — each of 4 checks (watchlist, deep-review hour, git dirty, token spend) in isolation

### PR-06: franken-heartbeat — Reflection & reporting tests

**Repo:** `franken-heartbeat`

- Unit tests for `PromptBuilder` and `ResponseParser`
- Unit tests for `ReflectionEngine` (mock `ILlmClient`, `IMemoryModule`, `IObservabilityModule`)
- Unit tests for `MorningBriefBuilder` and `ActionDispatcher`

### PR-07: franken-heartbeat — Orchestrator & CLI tests

**Repo:** `franken-heartbeat`

- Unit tests for `PulseOrchestrator` — happy path 6 phases, early-exit on no flags, error paths
- Integration test: full pulse cycle with file-system HEARTBEAT.md
- CLI smoke test (`args.ts` parsing)
- Exit: full module at >=80% line coverage

### PR-08: franken-critique — Evaluator unit tests

**Repo:** `franken-critique` **Priority:** MEDIUM

- Unit tests for each evaluator in isolation: Safety, GhostDependency, LogicLoop, Factuality, Conciseness, Complexity, Scalability, ADRCompliance
- Unit tests for `CritiquePipeline` — deterministic-first ordering, safety short-circuit behaviour

### PR-09: franken-critique — Breaker, loop & lesson tests

**Repo:** `franken-critique`

- Unit tests for each circuit breaker: MaxIteration, TokenBudget, ConsensusFailure
- Unit tests for `CritiqueLoop` — all 4 outcome paths (pass / fail / halted / escalated)
- Unit tests for `LessonRecorder`
- Exit: full module at >=80% line coverage

### PR-10: franken-governor — Trigger & security unit tests

**Repo:** `franken-governor` **Priority:** MEDIUM

- Unit tests for each trigger: Budget, Skill, Confidence, Ambiguity
- Unit tests for `TriggerRegistry` composition
- Unit tests for `SignatureVerifier` — HMAC sign/verify, timing-safe comparison
- Unit tests for `SessionTokenStore` — create, validate, TTL expiry

### PR-11: franken-governor — Gateway, channel & audit tests

**Repo:** `franken-governor`

- Unit tests for `ApprovalGateway` — timeout, signature verification, session token lifecycle
- Unit tests for `CliChannel` (mock readline)
- Unit tests for `GovernorCritiqueAdapter`
- Unit tests for `GovernorAuditRecorder`
- Exit: full module at >=80% line coverage

### PR-12: franken-planner — Wire public API

**Repo:** `franken-planner` **Priority:** MEDIUM

- Update `index.ts` to export `Planner`, `PlanGraph`, all strategy types, core types, errors
- Add `createPlanner()` factory if not present
- Add edge-case tests: empty DAG, single-node DAG, diamond dependency
- Verify integration tests pass for Linear, Parallel, Recursive strategies
- Exit: full public API exported, all tests green

### PR-13: frankenfirewall — Barrel fix & integration harness

**Repo:** `frankenfirewall` **Priority:** LOW

- Fix `index.ts` barrel to export `types/*`
- Add integration test for full `runPipeline()` with both Claude and OpenAI adapters (fixture responses)
- Verify all 18 existing test files still pass

### PR-14: franken-skills — Registry integration verification

**Repo:** `franken-skills` **Priority:** LOW

- Integration test for `createRegistry()` end-to-end: discovery + local loader + validator
- Verify dist builds clean

---

## Phase 2: LLM-Agnostic Adapter Layer

The firewall already has `IAdapter` for Claude and OpenAI. This phase formalises the provider-agnostic contract and adds coverage for additional providers, ensuring no module ever hardcodes an LLM.

### PR-15: frankenfirewall — IAdapter contract formalisation

**Repo:** `frankenfirewall`

- Extract `IAdapter` contract tests into a shared test suite (adapter conformance tests)
- Any adapter implementation can run this suite to prove compliance
- Verify `UnifiedRequest` / `UnifiedResponse` schemas are truly provider-agnostic (no Claude/OpenAI leakage)
- Document the "add a new provider" path: implement `IAdapter`, register in `AdapterRegistry`, run conformance tests

### PR-16: frankenfirewall — Additional adapter scaffolds

**Repo:** `frankenfirewall`

- Scaffold `IAdapter` stubs for Gemini, Mistral, and local/Ollama (showing the pattern, not full implementation)
- Each stub implements `IAdapter` with `TODO` bodies and a failing conformance test
- This proves the interface is truly provider-agnostic

### PR-17: franken-brain — LLM-agnostic ILlmClient

**Repo:** `franken-brain`

- Audit `ILlmClient` interface to ensure it does not leak provider-specific types
- If compression/summarisation prompts assume a specific provider format, abstract them behind `ILlmClient`
- Unit test: swap mock LLM implementations to prove the interface holds

### PR-18: franken-heartbeat — LLM-agnostic reflection

**Repo:** `franken-heartbeat`

- Same audit for `ILlmClient` in the reflection engine
- Verify `PromptBuilder` output is plain text / structured JSON, not provider-specific message format

---

## Phase 3: Inter-Module Contracts

Modules remain in their own repos. This phase verifies that port interfaces are structurally compatible across repos without creating hard dependencies. PRs land in the repo that *consumes* the port.

### PR-19: Contract audit & compatibility matrix

**Repo:** Root repo (this repo — `frankenbeast`)

- Catalog every port interface across all 8 modules (who defines it, who implements it)
- Produce a compatibility matrix document
- Identify any structural mismatches (e.g., `MemoryPort` in MOD-06 vs `MemoryOrchestrator` in MOD-03)

### PR-20: Shared types package — `@franken/types`

**Repo:** New repo `franken-types`

- Create `@franken/types` package with shared type definitions
- Extract duplicated types: `ProjectId`, `SessionId`, `TaskId`, `TokenBudget`, `Severity`, `Verdict`
- Define the `FrankenContext` schema: `globalState`, `plan`, `skillset`, `memory`, `audit`
- Publish as npm package (or use git dependency)

### PR-21: franken-critique — Adopt `@franken/types`

**Repo:** `franken-critique`

- Replace local `SessionId`, `TaskId` etc. with `@franken/types` imports
- Add compile-time assignability tests: `expectTypeOf<MemoryOrchestrator>().toMatchTypeOf<MemoryPort>()`
- No runtime behaviour change

### PR-22: franken-governor — Adopt `@franken/types`

**Repo:** `franken-governor`

- Same as PR-21 for governor port interfaces

### PR-23: franken-planner — Adopt `@franken/types`

**Repo:** `franken-planner`

- Same pattern. Verify `SelfCritiqueModule` in MOD-04 is satisfied by `GovernorCritiqueAdapter` in MOD-07

### PR-24: franken-heartbeat — Adopt `@franken/types`

**Repo:** `franken-heartbeat`

- Same pattern for `IMemoryModule`, `IObservabilityModule`, `IPlannerModule`, `ICritiqueModule`, `IHitlGateway`

---

## Phase 4: The Orchestrator ("The Beast Loop")

New repo: `franken-orchestrator`. Consumes all 8 modules as npm dependencies.

### PR-25: Orchestrator scaffold & FrankenContext

**Repo:** New repo `franken-orchestrator`

- TypeScript strict ESM + Vitest setup
- `OrchestratorConfig` — project ID, security level, token budget, provider selection, per-module config overrides
- `FrankenContext` implementation — mutable state container with typed sections
- `initializeContext(userInput)` — stub that returns empty context
- Unit tests for context creation and state transitions

### PR-26: Ingestion & Hydration (Beast Loop Phase 1)

**Repo:** `franken-orchestrator`

- Wire MOD-01 (Firewall) — PII masking + injection scanning on raw user input
- Wire MOD-03 (Memory) — inject ADRs and episodic traces into context
- Integration test: raw input with PII -> sanitised + hydrated context

### PR-27: Recursive Planning (Beast Loop Phase 2)

**Repo:** `franken-orchestrator`

- Wire MOD-04 (Planner) — `plan(context)` produces Task DAG
- Wire MOD-06 (Critique) — `review(plan)` produces Verdict
- Planning loop: plan -> critique -> re-plan (max 3 iterations)
- On 3x failure: escalate to MOD-07 (HITL)
- Integration tests: approved on first pass; approved on retry; escalated after 3 failures

### PR-28: Validated Execution (Beast Loop Phase 3)

**Repo:** `franken-orchestrator`

- Wire MOD-02 (Skills) — resolve skill contracts per task
- Wire MOD-07 (HITL) — pause for tasks marked `requiresApproval`
- Execute tasks in DAG topological order (Linear/Parallel per planner strategy)
- After each task: `MOD-03.record()` + `MOD-05.trace()`
- Integration test: 3-task DAG, one HITL pause, verify memory + traces recorded

### PR-29: Observability & Closure (Beast Loop Phase 4)

**Repo:** `franken-orchestrator`

- Wire MOD-05 (Observer) — final trace closure, token spend summary
- Wire MOD-08 (Heartbeat) — `triggerPulse(context)` for proactive improvements
- Orchestrator's own execution traced as root span with phase sub-spans
- Integration test: full loop from ingestion through pulse

### PR-30: Circuit breakers

**Repo:** `franken-orchestrator`

- Security breach: MOD-01 injection detection mid-flow -> immediate process kill
- Budget overrun: MOD-05 token spend > limit -> break loop, trigger MOD-07
- Recursive spiral: MOD-06 fails 3x on same plan -> escalate to human
- Unit tests for each breaker scenario in isolation
- Integration test: each breaker triggers correctly in a full loop

---

## Phase 5: Guardrails as a Service (OpenClaw Integration)

This is the standalone deployment model: Frankenbeast's firewall + critique modules wrapping *external* agent frameworks. The OpenClaw Gmail incident (context-window compression dropping safety constraints) is the exact failure mode this solves — safety constraints live in the firewall pipeline, never in the LLM prompt.

### PR-31: Standalone firewall server

**Repo:** `frankenfirewall`

- HTTP server mode: `@franken/firewall` exposes a REST API (or gRPC) as a proxy
- Endpoints: `POST /v1/chat/completions` (OpenAI-compatible), `POST /v1/messages` (Anthropic-compatible)
- Inbound interceptors run on every request; outbound interceptors run on every response
- Config via `guardrails.config.json` or environment variables
- This is the "guardrails as a service" entry point — any agent (OpenClaw, custom, etc.) points its LLM calls through this proxy

### PR-32: Standalone firewall — Docker & deployment

**Repo:** `frankenfirewall`

- Dockerfile for the proxy server
- Docker Compose example: agent -> franken-firewall proxy -> LLM provider
- Health check endpoint, readiness probe
- Configuration documentation

### PR-33: OpenClaw integration example

**Repo:** Root repo (`frankenbeast`)

- Example project: OpenClaw agent configured to route LLM calls through the Frankenbeast firewall proxy
- Demonstrates: PII masking, injection scanning, hallucination scraping, cost tracking
- Demonstrates the key guarantee: safety constraints survive context-window compression because they are enforced outside the LLM

### PR-34: Critique-as-a-service endpoint

**Repo:** `franken-critique`

- HTTP endpoint: `POST /v1/review` — accepts plan/output, returns critique verdict
- Can be called by external agents for plan validation without running the full Beast Loop
- Rate limiting, auth token, structured error responses

### PR-35: Standalone governor webhook receiver

**Repo:** `franken-governor`

- HTTP endpoint for HITL approval requests from external agents
- Webhook callback on approval/rejection
- Integrates with existing `SlackChannel` and `CliChannel`

---

## Phase 6: End-to-End Testing & Hardening

### PR-36: E2E test harness & fixtures

**Repo:** `franken-orchestrator`

- Fake LLM adapter (returns canned responses, configurable per test)
- In-memory implementations for all ports (memory, observability, skills)
- Test factory: `createTestBeast(overrides)` for quick scenario setup

### PR-37: E2E happy path + PII + critique retry

**Repo:** `franken-orchestrator`

- E2E: Happy path — input -> plan approved -> 2 tasks executed -> pulse fires
- E2E: PII detected -> scrubbed before planning reaches LLM
- E2E: Plan rejected by critique -> re-planned -> approved on second pass

### PR-38: E2E HITL + budget + injection + self-correction

**Repo:** `franken-orchestrator`

- E2E: High-stakes task -> HITL pause -> human approves -> execution continues
- E2E: Budget exceeded mid-execution -> circuit breaker -> HITL escalation
- E2E: Injection detected mid-flow -> immediate shutdown (no partial execution)
- E2E: Task fails -> self-correction -> fix-it task injected -> retry succeeds

### PR-39: Error recovery & resilience

**Repo:** `franken-orchestrator`

- Graceful shutdown on SIGINT/SIGTERM — flush traces, close DB connections
- Module init failure -> fail-fast with actionable error
- Context serialisation to disk for session resumption
- LLM adapter timeout -> retry with backoff (delegates to MOD-01 base adapter)

---

## Phase 7: CLI & Developer Experience

### PR-40: CLI entry point

**Repo:** `franken-orchestrator` (or new `franken-cli`)

- `npm run start:beast` / `npx frankenbeast` — boots all modules, enters Beast Loop
- CLI flags: `--project-id`, `--config`, `--provider` (claude/openai/ollama), `--dry-run`, `--verbose`
- Config file: `frankenbeast.config.json` (merged OrchestratorConfig + per-module overrides)

### PR-41: Local dev environment

**Repo:** Root repo (`frankenbeast`)

- Docker Compose for external deps: ChromaDB, optional Grafana + Tempo stack
- `.env.example` with all env vars (API keys, model selection, provider choice)
- Seed script: populate sample project with ADRs, skill definitions, episodic traces
- `HEARTBEAT.md` template

### PR-42: Documentation

**Repo:** Root repo (`frankenbeast`)

- Root README: architecture diagram, quickstart, module descriptions, the "why"
- Per-module README with public API reference
- "Add a new LLM provider" guide
- "Wrap an external agent" guide (the OpenClaw pattern)
- ADR template + initial ADRs (TypeScript, ESM, Vitest, port/adapter, deterministic-first)

---

## PR Dependency Graph

```
PHASE 1 — All parallel, each in its own repo
  PR-01 -> PR-02 -> PR-03 -> PR-04  (franken-brain, sequential within)
  PR-05 -> PR-06 -> PR-07           (franken-heartbeat, sequential within)
  PR-08 -> PR-09                    (franken-critique)
  PR-10 -> PR-11                    (franken-governor)
  PR-12                             (franken-planner)
  PR-13                             (frankenfirewall)
  PR-14                             (franken-skills)

PHASE 2 — Depends on Phase 1 completion for relevant modules
  PR-15 -> PR-16                    (frankenfirewall, after PR-13)
  PR-17                             (franken-brain, after PR-04)
  PR-18                             (franken-heartbeat, after PR-07)

PHASE 3 — Depends on Phase 2
  PR-19                             (root repo)
  PR-20                             (new: franken-types)
  PR-20 -> PR-21                    (franken-critique)
  PR-20 -> PR-22                    (franken-governor)
  PR-20 -> PR-23                    (franken-planner)
  PR-20 -> PR-24                    (franken-heartbeat)

PHASE 4 — Depends on Phase 3
  PR-25 -> PR-26 -> PR-27 -> PR-28 -> PR-29 -> PR-30  (franken-orchestrator, sequential)

PHASE 5 — Can start after Phase 2 (PR-15)
  PR-31 -> PR-32 -> PR-33          (firewall-as-a-service)
  PR-34                             (critique-as-a-service, after PR-09)
  PR-35                             (governor webhook, after PR-11)

PHASE 6 — Depends on Phase 4
  PR-36 -> PR-37 -> PR-38          (E2E tests)
  PR-39                             (resilience, after PR-36)

PHASE 7 — Depends on Phase 4
  PR-40                             (CLI, after PR-30)
  PR-41                             (local dev, after PR-30)
  PR-42                             (docs, after PR-40)
```

**Critical path:** PR-01 -> PR-04 -> PR-17 -> PR-20 -> PR-25 -> PR-30 -> PR-40

**Parallelism opportunities:**

- All Phase 1 module tracks run concurrently (7 parallel streams)
- Phase 5 (guardrails-as-a-service) can run in parallel with Phase 4 (orchestrator)
- PR-36 (test harness) + PR-40 (CLI) can run in parallel once PR-30 lands

---

## Module Dependency Map

```
                    ┌──────────────────┐
                    │   Orchestrator   │
                    └────────┬─────────┘
                             │ consumes all 8 as npm deps
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
     ┌─────────┐      ┌──────────┐       ┌──────────┐
     │ MOD-01  │      │  MOD-04  │       │  MOD-08  │
     │Firewall │      │ Planner  │       │Heartbeat │
     └────┬────┘      └────┬─────┘       └────┬─────┘
          │                │                   │
          │         ┌──────┼───────┐    ┌──────┼───────┐
          ▼         ▼      ▼       ▼    ▼      ▼       ▼
     ┌─────────┐ ┌─────┐┌──────┐┌────┐┌────┐┌──────┐┌─────┐
     │ MOD-02  │ │MOD01││MOD-03││MOD ││MOD ││MOD-03││MOD05│
     │ Skills  │ │     ││Memory││ 06 ││ 07 ││      ││ Obs │
     └─────────┘ └─────┘└──────┘│Crit││HITL│└──────┘└─────┘
                                └──┬─┘└──┬─┘
                                   │     │
                                ┌──┼─────┼──┐
                                ▼  ▼     ▼  ▼
                             ┌──────┐ ┌──────┐
                             │MOD-03│ │MOD-05│
                             │Memory│ │ Obs  │
                             └──────┘ └──────┘
```

Leaf modules (no downstream deps): **MOD-02** (Skills), **MOD-05** (Observer)

Foundation modules: **MOD-01** (Firewall), **MOD-03** (Memory)

Standalone-deployable: **MOD-01** (firewall proxy), **MOD-06** (critique endpoint), **MOD-07** (governor webhook)

---

## Open Questions

Resolve before or during implementation:

1. **Inter-module communication:** Direct function calls (current assumption) vs event bus? Direct calls are simplest for single-process; event bus enables the standalone service model in Phase 5.
2. **Persistence between sessions:** `FrankenContext` is in-memory. Should it serialise to disk? MOD-03 episodic memory partially covers this.
3. **ChromaDB for local dev:** Required, or should semantic memory fall back to a simpler in-memory vector store for development?
4. **CI/CD per repo:** Each module repo needs its own GitHub Actions pipeline. Standardise a shared workflow template?
5. **Release strategy:** `franken-skills` and `franken-brain` use `release-please`. Extend to all modules?
6. **Standalone firewall protocol:** REST (OpenAI-compatible proxy) vs gRPC vs both? REST is simplest for OpenClaw integration.
7. **OpenClaw integration depth:** Proxy-only (firewall wraps LLM calls) vs deeper hooks (critique reviews OpenClaw's plan before execution)?
