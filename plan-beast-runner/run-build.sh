#!/bin/bash
set -euo pipefail

# ============================================================
# Beast Runner — RALPH Loop Build Script
# ============================================================
# Processes chunk files 01-08 to build the CLI skill executor
# into franken-orchestrator. Uses the existing build-runner.ts
# from plan-2026-03-05 with observer-powered tracing.
#
# Usage:
#   ./plan-beast-runner/run-build.sh                    # start or resume
#   ./plan-beast-runner/run-build.sh --reset             # start fresh
#   ./plan-beast-runner/run-build.sh --budget 5          # $5 budget limit
#   ./plan-beast-runner/run-build.sh --no-viewer         # skip trace viewer
#   ./plan-beast-runner/run-build.sh --verbose           # debug-level logs
#
# Prerequisites:
#   - claude CLI installed and authenticated
#   - Node.js 20+ with npx
#   - franken-observer built (npm run build in franken-observer/)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNNER="${REPO_ROOT}/plan-2026-03-05/build-runner.ts"
BASE_BRANCH="feat/beast-runner"

# Ensure base branch exists
git checkout -b "$BASE_BRANCH" 2>/dev/null || git checkout "$BASE_BRANCH"

# Verify runner exists
if [ ! -f "$RUNNER" ]; then
  echo "Error: build-runner.ts not found at $RUNNER"
  echo "This script reuses the existing build runner from plan-2026-03-05/"
  exit 1
fi

# The build-runner.ts expects chunk files in its own directory by default.
# We override PLAN_DIR by symlinking or by passing the chunk dir.
# Since build-runner.ts resolves PLAN_DIR from import.meta.dirname,
# we need to tell it where our chunks are.
#
# Strategy: copy the runner temporarily, or just cd to our plan dir.
# Simplest: run the runner with our plan dir as CWD context.
# The runner reads *.md from PLAN_DIR which is import.meta.dirname.
# So we need to either:
#   a) Symlink our chunks into the runner's dir (messy)
#   b) Modify the runner to accept a --plan-dir arg (better)
#   c) Create a thin wrapper that overrides PLAN_DIR (pragmatic)
#
# Going with option (c): create a small TS entrypoint that imports
# the runner's logic. But since the runner is a standalone script,
# the simplest approach is to just symlink chunks and run.

# Create .build directory for artifacts (gitignored)
BUILD_DIR="${SCRIPT_DIR}/.build"
mkdir -p "$BUILD_DIR"

# Add .build to gitignore if not already there
GITIGNORE="${REPO_ROOT}/.gitignore"
if ! grep -q "plan-beast-runner/.build/" "$GITIGNORE" 2>/dev/null; then
  echo "plan-beast-runner/.build/" >> "$GITIGNORE"
fi

echo "============================================================"
echo "Beast Runner — CLI Skill Executor Build"
echo "============================================================"
echo "Plan dir:    ${SCRIPT_DIR}"
echo "Build dir:   ${BUILD_DIR}"
echo "Base branch: ${BASE_BRANCH}"
echo "Chunks:      $(ls "${SCRIPT_DIR}"/*.md 2>/dev/null | wc -l)"
echo "============================================================"

# Run the build runner with our plan directory
# We set PLAN_DIR env var and the runner picks it up
export BEAST_PLAN_DIR="$SCRIPT_DIR"
export BEAST_BUILD_DIR="$BUILD_DIR"
export BEAST_BASE_BRANCH="$BASE_BRANCH"

# For now, use claude directly in a simple loop since the build-runner.ts
# is hardcoded to its own PLAN_DIR. We implement a minimal ralph loop here.

CHECKPOINT_FILE="${BUILD_DIR}/.checkpoint"
LOG_FILE="${BUILD_DIR}/build.log"

log() {
  local msg="[$(date '+%H:%M:%S')] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

write_checkpoint() {
  echo "$1" >> "$CHECKPOINT_FILE"
}

is_checkpointed() {
  grep -qxF "$1" "$CHECKPOINT_FILE" 2>/dev/null
}

# Collect chunk files (skip this script and non-chunk files)
CHUNKS=()
for f in "${SCRIPT_DIR}"/*.md; do
  [ -f "$f" ] || continue
  CHUNKS+=("$f")
done

if [ ${#CHUNKS[@]} -eq 0 ]; then
  log "ERROR: No chunk files found in ${SCRIPT_DIR}"
  exit 1
fi

log "Found ${#CHUNKS[@]} chunks to process"

MAX_ITERATIONS="${MAX_ITERATIONS:-10}"
MAX_TURNS="${MAX_TURNS:-30}"

for CHUNK_FILE in "${CHUNKS[@]}"; do
  CHUNK_ID=$(basename "$CHUNK_FILE" .md)
  BRANCH="feat/${CHUNK_ID}"

  log "============================================================"
  log "CHUNK: ${CHUNK_ID}"
  log "============================================================"

  # Skip if already completed
  if is_checkpointed "${CHUNK_ID}:merged"; then
    log "${CHUNK_ID}: already merged (checkpoint), skipping"
    continue
  fi

  # Create chunk branch
  git checkout "$BASE_BRANCH"
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"

  CHUNK_CONTENT=$(cat "$CHUNK_FILE")

  # ── Implementation Loop ──
  if ! is_checkpointed "${CHUNK_ID}:impl_done"; then
    IMPL_PROMPT="Read the following chunk specification and implement ALL features described. Use TDD: write failing tests first, then implement, then commit atomically. Run the verification command at the end.

${CHUNK_CONTENT}

When ALL success criteria are met and the verification command passes, output exactly:
<promise>IMPL_${CHUNK_ID}_DONE</promise>"

    ITERATION=0
    IMPL_DONE=false

    while [ "$ITERATION" -lt "$MAX_ITERATIONS" ]; do
      ITERATION=$((ITERATION + 1))
      log "${CHUNK_ID}: impl iter ${ITERATION}/${MAX_ITERATIONS}"

      HEAD_BEFORE=$(git rev-parse HEAD)

      OUTPUT=$(claude --print \
        --dangerously-skip-permissions \
        --output-format stream-json \
        --verbose \
        --max-turns "$MAX_TURNS" \
        "$IMPL_PROMPT" 2>&1) || true

      # Auto-commit if dirty
      if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -m "auto: impl ${CHUNK_ID} iter ${ITERATION}" || true
      fi

      # Check for promise
      if echo "$OUTPUT" | grep -q "<promise>IMPL_${CHUNK_ID}_DONE</promise>"; then
        COMMITS=$(git rev-list --count "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")
        if [ "$COMMITS" -gt 0 ]; then
          write_checkpoint "${CHUNK_ID}:impl_done"
          log "${CHUNK_ID}: impl PASSED in ${ITERATION} iterations (${COMMITS} commits)"
          IMPL_DONE=true
          break
        else
          log "${CHUNK_ID}: promise detected but 0 commits — continuing"
        fi
      fi

      # Check for meaningful change
      HEAD_AFTER=$(git rev-parse HEAD)
      if [ "$HEAD_BEFORE" = "$HEAD_AFTER" ] && [ -z "$(git status --porcelain)" ]; then
        log "${CHUNK_ID}: no changes in iter ${ITERATION}"
      fi
    done

    if [ "$IMPL_DONE" != "true" ]; then
      log "ERROR: ${CHUNK_ID}: impl FAILED after ${MAX_ITERATIONS} iterations"
      exit 1
    fi
  else
    log "${CHUNK_ID}: impl already done (checkpoint), skipping"
  fi

  # ── Hardening Loop ──
  if ! is_checkpointed "${CHUNK_ID}:harden_done"; then
    HARDEN_PROMPT="Review the work on branch '${BRANCH}' for the following chunk specification. Check ALL success criteria and hardening requirements. Fix any issues, add edge-case tests, commit fixes.

${CHUNK_CONTENT}

Run the full test suite. When all criteria are met and tests pass, output exactly:
<promise>HARDEN_${CHUNK_ID}_DONE</promise>"

    ITERATION=0
    HARDEN_DONE=false
    HARDEN_MAX=$((MAX_ITERATIONS / 2))
    [ "$HARDEN_MAX" -lt 3 ] && HARDEN_MAX=3

    while [ "$ITERATION" -lt "$HARDEN_MAX" ]; do
      ITERATION=$((ITERATION + 1))
      log "${CHUNK_ID}: harden iter ${ITERATION}/${HARDEN_MAX}"

      OUTPUT=$(claude --print \
        --dangerously-skip-permissions \
        --output-format stream-json \
        --verbose \
        --max-turns 15 \
        "$HARDEN_PROMPT" 2>&1) || true

      # Auto-commit if dirty
      if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -m "auto: harden ${CHUNK_ID} iter ${ITERATION}" || true
      fi

      # Check for promise
      if echo "$OUTPUT" | grep -q "<promise>HARDEN_${CHUNK_ID}_DONE</promise>"; then
        COMMITS=$(git rev-list --count "${BASE_BRANCH}..HEAD" 2>/dev/null || echo "0")
        if [ "$COMMITS" -gt 0 ]; then
          write_checkpoint "${CHUNK_ID}:harden_done"
          log "${CHUNK_ID}: harden PASSED in ${ITERATION} iterations"
          HARDEN_DONE=true
          break
        fi
      fi
    done

    if [ "$HARDEN_DONE" != "true" ]; then
      log "WARN: ${CHUNK_ID}: harden didn't complete, continuing anyway"
    fi
  else
    log "${CHUNK_ID}: harden already done (checkpoint), skipping"
  fi

  # ── Merge back ──
  if ! is_checkpointed "${CHUNK_ID}:merged"; then
    COMMITS=$(git rev-list --count "${BASE_BRANCH}..${BRANCH}" 2>/dev/null || echo "0")
    if [ "$COMMITS" -gt 0 ]; then
      git checkout "$BASE_BRANCH"
      if git merge "$BRANCH" --no-edit; then
        write_checkpoint "${CHUNK_ID}:merged"
        log "${CHUNK_ID}: MERGED (${COMMITS} commits)"
      else
        log "ERROR: ${CHUNK_ID}: merge conflict"
        git merge --abort || true
        exit 1
      fi
    else
      log "WARN: ${CHUNK_ID}: no commits on branch, skipping merge"
    fi
  fi

  log "${CHUNK_ID}: DONE"
done

# ── Summary ──
log "============================================================"
log "BUILD COMPLETE"
log "============================================================"
MERGED=$(grep -c ":merged" "$CHECKPOINT_FILE" 2>/dev/null || echo "0")
log "Chunks merged: ${MERGED}/${#CHUNKS[@]}"
log "Branch: ${BASE_BRANCH}"
log "Log: ${LOG_FILE}"
