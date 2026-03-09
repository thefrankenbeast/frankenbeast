import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Removes all files from the .build/ directory (logs, checkpoints, traces db).
 * Returns the number of files removed.
 */
export function cleanupBuild(buildDir: string): number {
  if (!existsSync(buildDir)) return 0;

  let removed = 0;
  const removeRecursive = (target: string): void => {
    if (!existsSync(target)) return;
    const stat = statSync(target);

    if (stat.isDirectory()) {
      for (const entry of readdirSync(target)) {
        removeRecursive(join(target, entry));
      }
      rmSync(target, { recursive: true, force: true });
      removed++;
      return;
    }

    rmSync(target, { force: true });
    removed++;
  };

  for (const entry of readdirSync(buildDir)) {
    try {
      removeRecursive(join(buildDir, entry));
    } catch {
      // skip entries that can't be removed
    }
  }

  return removed;
}
