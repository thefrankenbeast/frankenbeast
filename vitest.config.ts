import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@franken/firewall': resolve(__dirname, 'frankenfirewall/src/index.ts'),
      '@franken/skills': resolve(__dirname, 'franken-skills/src/index.ts'),
      'franken-brain': resolve(__dirname, 'franken-brain/src/index.ts'),
      'franken-planner': resolve(__dirname, 'franken-planner/src/index.ts'),
      '@frankenbeast/observer': resolve(__dirname, 'franken-observer/src/index.ts'),
      '@franken/critique': resolve(__dirname, 'franken-critique/src/index.ts'),
      '@franken/governor': resolve(__dirname, 'franken-governor/src/index.ts'),
      'franken-heartbeat': resolve(__dirname, 'franken-heartbeat/src/index.ts'),
      '@franken/types': resolve(__dirname, 'franken-types/src/index.ts'),
      'franken-orchestrator': resolve(__dirname, 'franken-orchestrator/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 15_000,
  },
});
