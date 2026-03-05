# Frankenbeast — Explained Simply

## Elevator Pitch

> AI agents are powerful but reckless. They forget safety rules, make stuff up, and take dangerous actions without asking. **Frankenbeast is a safety cage that wraps around any AI agent** — it checks everything going in and coming out, forces the AI to show its work, and makes it ask a human before doing anything risky. The safety rules live *outside* the AI's brain, so the AI can never forget them, talk itself out of them, or pretend they don't exist.

---

## What Problem Does This Solve?

Imagine you hired an incredibly smart intern. They can write code, answer questions, make plans — amazing. But sometimes they:

- **Forget the rules** you told them earlier (especially when the conversation gets long)
- **Make things up** and confidently tell you they're real
- **Do dangerous things** without asking first (like deleting files or sending emails)
- **Ignore security policies** because they got confused or distracted

That's what AI agents do today. The safety instructions are just words in a prompt — and the AI can forget them, reinterpret them, or lose them when the conversation gets too long.

**Frankenbeast fixes this by putting the safety rules in code, not in words.**

Think of it like the difference between telling a new driver "don't go over 60mph" versus installing a speed limiter in the car. The speed limiter works whether the driver remembers the rule or not.

---

## How Does It Work? (The Simple Version)

Frankenbeast works like a security checkpoint at an airport. Everything goes through screening — both on the way in and on the way out.

### Step 1: Screening (The Firewall)

When you send a message to the AI, Frankenbeast intercepts it first:

- **Strips out personal info** (credit cards, phone numbers, etc.) so the AI never sees it
- **Checks for trick attacks** where someone tries to manipulate the AI into doing bad things
- **Makes sure the request actually matches what the project is supposed to do**

### Step 2: Planning (The Planner + Critic)

Before the AI does anything, it has to make a plan. Then a separate system reviews that plan:

- Does the plan make sense? Are there circular dependencies?
- Is the AI using approved tools, or is it making up tools that don't exist?
- Does this match how the project is supposed to work?

If the plan fails review 3 times in a row, a human gets called in.

### Step 3: Doing the Work (Skills + Human Approval)

When it's time to actually do things:

- The AI can only use **registered tools** — it can't just invent new ones
- **High-risk actions pause and ask a human** for approval (like a "Are you sure?" popup, but with cryptographic signatures so the approval can't be faked)
- Everything is done in the order the plan specified

### Step 4: Checking the Work (Observer + Heartbeat)

After the work is done:

- Every action is logged — what happened, how much it cost, how long it took
- The system runs a health check to see if anything looks off
- It can even suggest improvements for next time

---

## The 8 Modules in Plain English

Think of Frankenbeast as a team of 8 specialists, each with one job:

| # | Name | Plain English Job |
|---|------|-------------------|
| 1 | **Firewall** | The bouncer. Checks everything going in and out. Blocks attacks, hides personal data, catches hallucinated nonsense. |
| 2 | **Skills** | The toolbox manager. Keeps a list of approved tools the AI is allowed to use. If a tool isn't on the list, the AI can't use it. |
| 3 | **Brain** | The memory system. Remembers past conversations, past mistakes, and project knowledge — so the AI doesn't repeat errors. |
| 4 | **Planner** | The project manager. Turns "build me a feature" into a step-by-step task list with dependencies. |
| 5 | **Observer** | The accountant. Tracks every action, every API call, every dollar spent. Exports reports. |
| 6 | **Critique** | The code reviewer. Reviews the AI's plan and output before it ships. Catches logical errors, security issues, and bad patterns. |
| 7 | **Governor** | The approval manager. When something is high-risk, it pauses everything and asks a human. Uses cryptographic signatures so approvals can't be faked. |
| 8 | **Heartbeat** | The night watchman. Runs periodic health checks, looks for patterns in past failures, and suggests improvements. |

---

## Why Not Just Use Better Prompts?

This is the most common question. Here's the core issue:

**Prompts are suggestions. Frankenbeast's guardrails are enforced.**

| Prompt-Based Safety | Frankenbeast Safety |
|---------------------|---------------------|
| "Please don't share personal data" | Code automatically detects and masks personal data before the AI ever sees it |
| "Only use approved tools" | A registry physically prevents unapproved tools from being called |
| "Ask before doing anything dangerous" | Cryptographically signed approval required — the AI literally cannot proceed without it |
| "Stay within budget" | A circuit breaker kills the process when the budget is exceeded |
| Rules get lost when the conversation gets long | Rules live in the pipeline, not the conversation — they can never be lost |

The key insight: **safety constraints that live inside the AI's context window will eventually be forgotten. Constraints that live outside the AI's context window cannot be.**

---

## What's a "Vibe Coder" Use Case?

If you're building AI-powered apps by prompting and iterating (vibe coding), Frankenbeast helps you in a few ways:

1. **Cost protection** — Set a dollar limit. The system stops before you accidentally burn through your API budget.
2. **Undo protection** — The AI has to get approval before destructive actions. No more "oops, it deleted my database."
3. **Quality checks** — The Critique module reviews the AI's output before it reaches you, catching common issues automatically.
4. **Memory across sessions** — The Brain module remembers what worked and what didn't, so the AI doesn't repeat past mistakes.
5. **Works with any AI** — Swap between Claude, GPT, Gemini, or whatever comes next. The safety layer stays the same.

---

## One-Line Summary

**Frankenbeast is a seatbelt for AI agents — it doesn't slow you down, but it stops you from going through the windshield.**
