# Frankenbeast Architecture

## Module Interconnections

```mermaid
    graph TB
        User([User Input])

        subgraph "MOD-01: Frankenfirewall"
            direction TB
            FW_IN["Inbound Interceptors<br/>• Injection Scanner<br/>• PII Masker<br/>• Project Alignment"]
            FW_ADAPT["Adapter Pipeline<br/>• ClaudeAdapter<br/>• OpenAIAdapter<br/>• (Extensible)"]
            FW_OUT["Outbound Interceptors<br/>• Schema Enforcer<br/>• Deterministic Grounder<br/>• Hallucination Scraper"]
            FW_IN --> FW_ADAPT --> FW_OUT
        end

        subgraph "MOD-02: Franken Skills"
            direction TB
            SK_REG["Skill Registry<br/>ISkillRegistry"]
            SK_DISC["Discovery Service<br/>Global + Local"]
            SK_VAL["Skill Validator<br/>Zod Contracts"]
            SK_DISC --> SK_REG
            SK_VAL --> SK_REG
        end

        subgraph "MOD-03: Franken Brain"
            direction TB
            MEM_WORK["Working Memory<br/>In-process turns"]
            MEM_EPIS["Episodic Memory<br/>SQLite traces"]
            MEM_SEM["Semantic Memory<br/>ChromaDB vectors"]
            MEM_ORCH["Memory Orchestrator"]
            MEM_PII["PII Guards<br/>Decorator pattern"]
            MEM_ORCH --> MEM_WORK
            MEM_ORCH --> MEM_EPIS
            MEM_ORCH --> MEM_SEM
            MEM_PII -.-> MEM_EPIS
            MEM_PII -.-> MEM_SEM
        end

        subgraph "MOD-04: Franken Planner"
            direction TB
            PL_INTENT["Intent Parser"]
            PL_DAG["DAG Builder<br/>Graph + Cycle Detection"]
            PL_STRAT["Planning Strategies<br/>• Linear<br/>• Parallel<br/>• Recursive"]
            PL_COT["CoT Gate<br/>RationaleBlock"]
            PL_EXEC["Task Executor"]
            PL_RECOV["Recovery Controller<br/>Self-correction loop"]
            PL_HITL["Plan HITL Gate<br/>Markdown export"]
            PL_INTENT --> PL_DAG --> PL_STRAT
            PL_STRAT --> PL_HITL --> PL_EXEC
            PL_EXEC --> PL_COT
            PL_EXEC --> PL_RECOV
        end

        subgraph "MOD-05: Franken Observer"
            direction TB
            OB_TRACE["Trace Context<br/>Spans + Lifecycle"]
            OB_COST["Cost Tracking<br/>TokenCounter + CostCalc"]
            OB_CB["Circuit Breaker<br/>Budget guard"]
            OB_EXPORT["Export Adapters<br/>• OTEL • SQLite<br/>• Langfuse • Prometheus<br/>• Tempo"]
            OB_EVAL["Eval Framework<br/>• ToolCallAccuracy<br/>• ADR Adherence<br/>• Golden Trace<br/>• LLM Judge"]
            OB_LOOP["Loop Detector<br/>+ PostMortem"]
            OB_TRACE --> OB_EXPORT
            OB_COST --> OB_CB
        end

        subgraph "MOD-06: Franken Critique"
            direction TB
            CR_PIPE["Critique Pipeline"]
            CR_DET["Deterministic Evaluators<br/>• Safety • GhostDep<br/>• LogicLoop • ADR"]
            CR_HEUR["Heuristic Evaluators<br/>• Factuality • Conciseness<br/>• Complexity • Scalability"]
            CR_BREAK["Circuit Breakers<br/>• MaxIteration<br/>• TokenBudget<br/>• ConsensusFailure"]
            CR_LOOP["Critique Loop"]
            CR_LESSON["Lesson Recorder"]
            CR_DET --> CR_PIPE
            CR_HEUR --> CR_PIPE
            CR_PIPE --> CR_LOOP
            CR_BREAK --> CR_LOOP
        end

        subgraph "MOD-07: Franken Governor"
            direction TB
            GOV_TRIG["Trigger Evaluators<br/>• Budget • Skill<br/>• Confidence • Ambiguity"]
            GOV_GW["Approval Gateway"]
            GOV_CHAN["Approval Channels<br/>• CLI • Slack"]
            GOV_SEC["Security<br/>HMAC-SHA256 Signing<br/>Session Tokens"]
            GOV_AUDIT["Governor Audit<br/>Recorder"]
            GOV_TRIG --> GOV_GW
            GOV_CHAN --> GOV_GW
            GOV_SEC --> GOV_GW
        end

        subgraph "MOD-08: Franken Heartbeat"
            direction TB
            HB_DET["Phase 1: Deterministic Check<br/>Watchlist, Git, Tokens"]
            HB_REFL["Phase 2: Reflection Engine<br/>LLM-powered analysis"]
            HB_DISP["Phase 3: Action Dispatcher<br/>Inject tasks + alerts"]
            HB_BRIEF["Morning Brief<br/>Generator"]
            HB_DET --> HB_REFL --> HB_DISP --> HB_BRIEF
        end

        LLM[(LLM Providers<br/>Claude / OpenAI / ...)]

        %% === USER FLOW ===
        User --> FW_IN
        FW_ADAPT --> LLM
        LLM --> FW_ADAPT

        %% === MOD-01 → MOD-04: Sanitized Intent ===
        FW_OUT -- "getSanitizedIntent()<br/>→ Intent" --> PL_INTENT

        %% === MOD-01 ↔ MOD-02: Tool call grounding ===
        FW_OUT -- "validateToolCalls()<br/>against registry" --> SK_REG

        %% === MOD-04 → MOD-02: Skill discovery ===
        PL_DAG -- "getAvailableSkills()<br/>hasSkill()" --> SK_REG

        %% === MOD-04 → MOD-03: Context loading ===
        PL_DAG -- "getADRs()<br/>getKnownErrors()<br/>getProjectContext()" --> MEM_ORCH
        PL_EXEC -- "recordToolResult()" --> MEM_EPIS

        %% === MOD-04 → MOD-07: CoT verification ===
        PL_COT -- "verifyRationale()<br/>RationaleBlock" --> GOV_TRIG

        %% === MOD-06 → MOD-01: Safety rules ===
        CR_DET -- "getSafetyRules()<br/>executeSandbox()" --> FW_IN

        %% === MOD-06 → MOD-03: ADRs + lessons ===
        CR_DET -- "searchADRs()" --> MEM_SEM
        CR_LESSON -- "recordLesson()" --> MEM_EPIS

        %% === MOD-06 → MOD-05: Token spend ===
        CR_BREAK -- "getTokenSpend()" --> OB_COST

        %% === MOD-06 → MOD-07: Escalation ===
        CR_LOOP -- "requestHumanReview()<br/>on escalation" --> GOV_GW

        %% === MOD-07 → MOD-03: Audit trail ===
        GOV_AUDIT -- "record audit<br/>EpisodicTrace" --> MEM_EPIS

        %% === MOD-07 → MOD-02: HITL skill check ===
        GOV_TRIG -- "requires_hitl?" --> SK_REG

        %% === MOD-07 → MOD-05: Budget trigger ===
        GOV_TRIG -- "budget check" --> OB_CB

        %% === MOD-08 → MOD-03: Traces + lessons ===
        HB_REFL -- "getRecentTraces()<br/>getSuccesses/Failures()<br/>recordLesson()" --> MEM_ORCH

        %% === MOD-08 → MOD-05: Observability ===
        HB_DET -- "getTraces()<br/>getTokenSpend()" --> OB_TRACE

        %% === MOD-08 → MOD-04: Task injection ===
        HB_DISP -- "injectTask()<br/>self-improvement" --> PL_EXEC

        %% === MOD-08 → MOD-06: Audit conclusions ===
        HB_REFL -- "auditConclusions()" --> CR_LOOP

        %% === MOD-08 → MOD-07: Alerts + brief ===
        HB_BRIEF -- "sendMorningBrief()<br/>notifyAlert()" --> GOV_GW

        %% === MOD-05 ← All: Span emission ===
        PL_EXEC -. "emit spans" .-> OB_TRACE
        FW_ADAPT -. "emit spans" .-> OB_TRACE
        CR_LOOP -. "emit spans" .-> OB_TRACE
        GOV_GW -. "emit spans" .-> OB_TRACE

        %% === Output back to user ===
        GOV_GW -- "approval<br/>requests" --> User
        HB_BRIEF -- "morning<br/>brief" --> User
        PL_EXEC -- "final<br/>result" --> User

        %% === STYLING ===
        classDef firewall fill:#ff6b6b,stroke:#c0392b,color:#fff
        classDef skills fill:#54a0ff,stroke:#2e86de,color:#fff
        classDef brain fill:#5f27cd,stroke:#341f97,color:#fff
        classDef planner fill:#ff9f43,stroke:#ee5a24,color:#fff
        classDef observer fill:#10ac84,stroke:#0a3d62,color:#fff
        classDef critique fill:#f368e0,stroke:#c44569,color:#fff
        classDef governor fill:#feca57,stroke:#f6b93b,color:#333
        classDef heartbeat fill:#48dbfb,stroke:#0abde3,color:#333
        classDef external fill:#dfe6e9,stroke:#636e72,color:#333

        class FW_IN,FW_ADAPT,FW_OUT firewall
        class SK_REG,SK_DISC,SK_VAL skills
        class MEM_WORK,MEM_EPIS,MEM_SEM,MEM_ORCH,MEM_PII brain
        class PL_INTENT,PL_DAG,PL_STRAT,PL_COT,PL_EXEC,PL_RECOV,PL_HITL planner
        class OB_TRACE,OB_COST,OB_CB,OB_EXPORT,OB_EVAL,OB_LOOP observer
        class CR_PIPE,CR_DET,CR_HEUR,CR_BREAK,CR_LOOP,CR_LESSON critique
        class GOV_TRIG,GOV_GW,GOV_CHAN,GOV_SEC,GOV_AUDIT governor
        class HB_DET,HB_REFL,HB_DISP,HB_BRIEF heartbeat
        class User,LLM external
```
