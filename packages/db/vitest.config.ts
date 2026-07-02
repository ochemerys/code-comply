import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.spec.ts'],
    testTimeout: 30_000,
    // Shared Postgres: avoid parallel files/tests mutating the same tables
    fileParallelism: false,
    maxConcurrency: 1,
    poolOptions: {
      threads: { singleThread: true },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', '__tests__/**/*.spec.ts'],
      exclude: ['**/*.spec.ts.snap'],
      // Align with testing-strategy.md §6.1 / §11.2: lines & statements 80%+.
      // Branch/function aggregates are misleading for tiny `src` + large spec files; per-file lines still enforced.
      thresholds: {
        lines: 80,
        statements: 80,
      },
    },
  },
})
