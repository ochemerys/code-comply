import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/inspector/vitest.config.ts',
  'apps/api/vitest.config.ts',
  'packages/ui/vitest.config.ts',
  'packages/validators/vitest.config.ts',
  'packages/utils/vitest.config.ts',
])
