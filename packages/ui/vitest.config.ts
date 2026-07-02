import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/components/**/*.vue'],
      exclude: ['**/*.spec.ts', '**/*.d.ts', '**/node_modules/**', '**/dist/**', '**/.turbo/**'],
      thresholds: {
        lines: 75,
        functions: 50,
        branches: 75,
        statements: 75,
      },
    },
  },
})
