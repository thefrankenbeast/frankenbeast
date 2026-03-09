import { ANSI } from '../logging/beast-logger.js';

/**
 * Parses stream-json lines from the Claude CLI and renders
 * meaningful progress to the terminal: thinking status, tool use,
 * chunk IDs detected in text output, and completion stats.
 */
export function createStreamProgressHandler(
  write: (text: string) => void = (t) => process.stderr.write(t),
): (line: string) => void {
  let lastToolName = '';
  let showedThinking = false;
  let textAccumulator = '';
  const seenChunkIds = new Set<string>();

  return (line: string) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return; // Not JSON — skip
    }

    // Skip hook output
    if ('hookSpecificOutput' in obj) return;

    const type = obj['type'] as string | undefined;

    // content_block_start: detect thinking or tool_use blocks
    if (type === 'content_block_start') {
      const block = obj['content_block'] as Record<string, unknown> | undefined;
      if (!block) return;

      if (block['type'] === 'thinking' && !showedThinking) {
        showedThinking = true;
        write(`  ${ANSI.dim}Reasoning...${ANSI.reset}\n`);
      }

      if (block['type'] === 'tool_use') {
        lastToolName = block['name'] as string;
      }

      // Reset text accumulator for new text blocks
      if (block['type'] === 'text') {
        textAccumulator = '';
      }
    }

    // content_block_delta: tool input or text output
    if (type === 'content_block_delta') {
      const delta = obj['delta'] as Record<string, unknown> | undefined;
      if (!delta) return;

      // Tool input — show file paths
      if (delta['type'] === 'input_json_delta' && lastToolName) {
        const partial = delta['partial_json'] as string | undefined;
        if (partial) {
          const pathMatch = partial.match(/"file_path"\s*:\s*"([^"]+)"/);
          if (pathMatch?.[1]) {
            const action = toolAction(lastToolName);
            const shortPath = shortenPath(pathMatch[1]);
            write(`  ${ANSI.dim}${action} ${shortPath}${ANSI.reset}\n`);
            lastToolName = ''; // Only show once per tool use
          }
        }
      }

      // Text delta — accumulate and detect chunk IDs
      if (delta['type'] === 'text_delta') {
        const text = delta['text'] as string | undefined;
        if (text) {
          textAccumulator += text;
          detectChunkIds(textAccumulator, seenChunkIds, write);
        }
      }
    }

    // result event: show completion stats
    if (type === 'result') {
      const cost = obj['cost_usd'] as number | undefined;
      const duration = obj['duration_ms'] as number | undefined;
      const numTurns = obj['num_turns'] as number | undefined;
      const parts: string[] = [];
      if (duration !== undefined) parts.push(`${(duration / 1000).toFixed(1)}s`);
      if (cost !== undefined) parts.push(`$${cost.toFixed(4)}`);
      if (numTurns !== undefined && numTurns > 1) parts.push(`${numTurns} turns`);
      if (parts.length > 0) {
        write(`  ${ANSI.dim}LLM done (${parts.join(', ')})${ANSI.reset}\n`);
      }
    }
  };
}

/**
 * Scan accumulated text for JSON chunk `"id": "..."` patterns.
 * Each new chunk ID found triggers a progress line.
 */
function detectChunkIds(
  text: string,
  seen: Set<string>,
  write: (text: string) => void,
): void {
  // Match "id": "some-chunk-id" patterns in JSON array output
  const pattern = /"id"\s*:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const id = match[1]!;
    if (!seen.has(id)) {
      seen.add(id);
      write(`  ${ANSI.dim}Planned chunk:${ANSI.reset} ${id}\n`);
    }
  }
}

function toolAction(name: string): string {
  switch (name) {
    case 'Write': return 'Writing';
    case 'Read': return 'Reading';
    case 'Edit': return 'Editing';
    case 'Glob': return 'Searching';
    case 'Grep': return 'Searching';
    case 'Bash': return 'Running';
    default: return `Using ${name}:`;
  }
}

function shortenPath(fullPath: string): string {
  const parts = fullPath.split('/');
  if (parts.length <= 3) return fullPath;
  return '.../' + parts.slice(-3).join('/');
}
