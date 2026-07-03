import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: [
        'src/**/*-config.spec.ts',
        '__tests__/integration/**/*-scenarios.integration.spec.ts',
      ],
      env: {
        CODECOMPLY_COMPLIANCE_PROFILE: 'internal',
      },
    },
  }),
)
