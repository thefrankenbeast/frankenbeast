import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanupBuild } from '../../../src/cli/cleanup.js';

describe('cleanupBuild', () => {
  it('removes nested chunk session directories', () => {
    const root = mkdtempSync(join(tmpdir(), 'cleanup-'));
    const nested = join(root, 'chunk-sessions', 'demo-plan');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, '01_demo.json'), '{}');

    const removed = cleanupBuild(root);

    expect(removed).toBeGreaterThan(0);
    expect(existsSync(nested)).toBe(false);

    rmSync(root, { recursive: true, force: true });
  });
});
