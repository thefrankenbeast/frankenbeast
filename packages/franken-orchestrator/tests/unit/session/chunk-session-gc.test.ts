import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChunkSessionGc } from '../../../src/session/chunk-session-gc.js';
import { FileChunkSessionStore } from '../../../src/session/chunk-session-store.js';
import { createChunkSession } from '../../../src/session/chunk-session.js';

describe('ChunkSessionGc', () => {
  it('deletes expired completed sessions and orphaned snapshots but retains recent active ones', () => {
    const root = mkdtempSync(join(tmpdir(), 'chunk-gc-'));
    const sessionRoot = join(root, 'chunk-sessions');
    const snapshotRoot = join(root, 'chunk-session-snapshots');
    const store = new FileChunkSessionStore(sessionRoot);
    const now = new Date('2026-03-09T12:00:00.000Z');

    store.save({
      ...createChunkSession({
        planName: 'demo-plan',
        taskId: 'impl:old_done',
        chunkId: 'old_done',
        promiseTag: 'IMPL_old_done_DONE',
        workingDir: root,
        provider: 'claude',
        maxTokens: 200000,
      }),
      status: 'completed',
      updatedAt: '2026-03-07T00:00:00.000Z',
    });
    store.save({
      ...createChunkSession({
        planName: 'demo-plan',
        taskId: 'impl:active',
        chunkId: 'active',
        promiseTag: 'IMPL_active_DONE',
        workingDir: root,
        provider: 'claude',
        maxTokens: 200000,
      }),
      status: 'active',
      updatedAt: '2026-03-09T11:30:00.000Z',
    });

    const orphanDir = join(snapshotRoot, 'demo-plan', 'orphan');
    mkdirSync(orphanDir, { recursive: true });
    writeFileSync(join(orphanDir, 'snapshot.json'), '{}');

    const gc = new ChunkSessionGc({
      sessionRoot,
      snapshotRoot,
      completedTtlMs: 24 * 60 * 60 * 1000,
      failedTtlMs: 72 * 60 * 60 * 1000,
    });

    const removed = gc.collect(now);

    expect(removed).toBeGreaterThanOrEqual(2);
    expect(store.load('demo-plan', 'old_done')).toBeUndefined();
    expect(store.load('demo-plan', 'active')).toBeDefined();
    expect(existsSync(orphanDir)).toBe(false);

    rmSync(root, { recursive: true, force: true });
  });
});
