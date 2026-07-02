import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@codecomply/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    server: {
      deps: {
        // workbox-* ship ESM files inside CommonJS packages (e.g.
        // workbox-background-sync/lib/QueueStore.js), which Node cannot
        // require() directly. Inlining lets vitest transform them.
        inline: [/workbox-/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**'],
      // Only measure files actually exercised by tests.
      all: false,
      exclude: [
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/.turbo/**',
        '**/public/**',
        '**/dev-dist/**',
        // Dev-only / documentation shells — little automated coverage value; see testing-strategy §6.1 notes.
        '**/AnnotatePhotoE2EView.vue',
        '**/UserManualView.vue',
        '**/ProfileView.vue',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
})
