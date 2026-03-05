# Contract Matrix: Cross-Module Port Interfaces

> Catalogs every port interface, its defining module, consuming module(s), and structural compatibility status.

## Port Interfaces

| Port Interface | Defining Module | Consuming Module(s) | Structural Match? |
|---|---|---|---|
| `IAdapter` | MOD-01 firewall | Orchestrator | Yes |
| `ISkillRegistry` | MOD-02 skills | MOD-04 planner (via `SkillsModule`) | Needs adapter |
| `ILlmClient` (brain) | MOD-03 brain | MOD-03 internal | Yes |
| `ILlmClient` (heartbeat) | MOD-08 heartbeat | MOD-08 internal | Different return type |
| `GuardrailsModule` | MOD-04 planner | MOD-01 firewall impl | Yes |
| `SkillsModule` | MOD-04 planner | MOD-02 skills impl | Needs adapter |
| `MemoryModule` | MOD-04 planner | MOD-03 brain impl | Needs adapter |
| `SelfCritiqueModule` | MOD-04 planner | MOD-07 governor impl | Structural match (minus branded TaskId) |
| `GuardrailsPort` | MOD-06 critique | MOD-01 firewall impl | Needs adapter |
| `MemoryPort` | MOD-06 critique | MOD-03 brain impl | Needs adapter |
| `ObservabilityPort` | MOD-06 critique | MOD-05 observer impl | Needs adapter |
| `EscalationPort` | MOD-06 critique | MOD-07 governor impl | Needs adapter |
| `GovernorMemoryPort` | MOD-07 governor | MOD-03 brain impl | Needs adapter |
| `ApprovalChannel` | MOD-07 governor | CLI/Slack channel impl | Yes |
| `IMemoryModule` | MOD-08 heartbeat | MOD-03 brain impl | Needs adapter |
| `IObservabilityModule` | MOD-08 heartbeat | MOD-05 observer impl | Needs adapter |
| `IPlannerModule` | MOD-08 heartbeat | MOD-04 planner impl | Needs adapter |
| `ICritiqueModule` | MOD-08 heartbeat | MOD-06 critique impl | Needs adapter |
| `IHitlGateway` | MOD-08 heartbeat | MOD-07 governor impl | Needs adapter |

## Type Mismatches Requiring Resolution

### 1. TaskId Branding
- **Planner** (`franken-planner/src/core/types.ts:6`): `TaskId = string & { readonly __brand: 'TaskId' }`
- **Critique** (`franken-critique/src/types/common.ts:17`): `TaskId = string`
- **Governor** (`franken-governor/src/gateway/governor-critique-adapter.ts:9`): `taskId: string`
- **Resolution**: Adopt branded `TaskId` in `@franken/types`. Critique and governor import from shared.

### 2. Severity Scale Divergence
- **Critique** (`franken-critique/src/types/common.ts:2`): `'critical' | 'warning' | 'info'`
- **Governor** (`franken-governor/src/core/types.ts:3`): `'low' | 'medium' | 'high' | 'critical'`
- **Heartbeat** (`franken-heartbeat/src/core/types.ts:6`): `'low' | 'medium' | 'high'`
- **Resolution**: Superset `Severity` in `@franken/types` with module-specific subsets.

### 3. RationaleBlock Duplication
- **Canonical** (`franken-planner/src/core/types.ts:81-91`)
- **Local copy** (`franken-governor/src/gateway/governor-critique-adapter.ts:8-18`)
- **Resolution**: Single definition in `@franken/types`, both import from there.

### 4. ILlmClient Return Type Divergence
- **Brain** (`franken-brain/src/compression/llm-client-interface.ts`): `Promise<string>`
- **Heartbeat** (`franken-heartbeat/src/reflection/types.ts`): `Promise<Result<string>>`
- **Resolution**: Two interfaces in `@franken/types`: `ILlmClient` (string) and `IResultLlmClient` (Result).

### 5. EpisodicTrace Quadruple-Definition
- **Brain** (`franken-brain/src/types/memory.ts:46-54`): Zod-backed, `input`/`output` fields
- **Critique** (`franken-critique/src/types/contracts.ts:28-33`): `summary`/`outcome` fields
- **Governor** (`franken-governor/src/audit/governor-memory-port.ts:1-12`): `toolName`/`tags` fields
- **Heartbeat** (`franken-heartbeat/src/modules/memory.ts:5-11`): `summary`/`timestamp` fields
- **Resolution**: Each module keeps its own projection (different shapes serve different purposes). Document that these are intentional views, not duplicates.

### 6. Zod Version Split
- **Heartbeat**: `zod/v4` (Zod 4.x import path)
- **Critique**: `zod` 3.24.x
- **Resolution**: `@franken/types` uses Zod 4. Critique continues with Zod 3 internally. Shared types avoid Zod runtime validation at the boundary (use TypeScript types only for cross-module contracts).
