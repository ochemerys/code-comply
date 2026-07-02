/**
 * M11-S19 — Production CI/CD pipeline stages, acceptance criteria, and workflow validators.
 * GitHub Actions workflows must stay aligned with this config (see scripts/ci-pipeline-audit.mjs).
 */

export const CI_PIPELINE_STORY_ID = 'M11-S19'

export const PIPELINE_STAGES = [
  'lint',
  'type-check',
  'unit-tests',
  'integration-tests',
  'build',
  'e2e-tests',
  'deploy-staging',
  'deploy-production',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const ACCEPTANCE_CRITERIA = [
  'github-actions-pipeline',
  'tests-on-pr',
  'staging-on-develop',
  'production-on-main',
  'manual-production-approval',
] as const

export type AcceptanceCriterion = (typeof ACCEPTANCE_CRITERIA)[number]

export const CI_TRIGGER_BRANCHES = ['develop', 'main'] as const

export const WORKFLOW_PATHS = {
  ci: '.github/workflows/ci.yml',
  deployStaging: '.github/workflows/deploy-staging.yml',
  deployProduction: '.github/workflows/deploy-production.yml',
} as const

/** Job id → required substrings in ci.yml job block */
export const CI_JOB_MARKERS: Record<PipelineStage, readonly string[]> = {
  lint: ['name: Lint', 'pnpm lint', 'pnpm format:check'],
  'type-check': ['name: Type Check', 'pnpm typecheck'],
  'unit-tests': ['name: Unit Tests', 'pnpm test:unit'],
  'integration-tests': ['name: Integration Tests', 'pnpm test:integration', 'postgres:16-alpine'],
  build: ['name: Build All Packages', 'pnpm build'],
  'e2e-tests': ['name: E2E Tests', 'Dockerfile.e2e'],
  'deploy-staging': ['name: Deploy to Staging', 'RENDER_API_STAGING_HOOK'],
  'deploy-production': [
    'name: Deploy to Production',
    'environment: production',
    'RENDER_API_PRODUCTION_HOOK',
  ],
}

/** Markers proving PR + branch deploy acceptance criteria */
export const WORKFLOW_TRIGGER_MARKERS = {
  pullRequest: ['pull_request:', 'branches: [develop, main]'],
  stagingOnDevelop: ["github.ref == 'refs/heads/develop'", 'RENDER_API_STAGING_HOOK'],
  productionOnMain: ["github.ref == 'refs/heads/main'", 'RENDER_API_PRODUCTION_HOOK'],
  manualProductionApproval: ['environment: production'],
  rollbackDispatch: ['workflow_dispatch:'],
} as const

export interface PipelineValidationResult {
  ok: boolean
  missingStages: PipelineStage[]
  missingTriggers: string[]
}

export function coversAllPipelineStages(found: readonly string[]): boolean {
  return PIPELINE_STAGES.every((stage) => found.includes(stage))
}

export function coversAllAcceptanceCriteria(found: readonly string[]): boolean {
  return ACCEPTANCE_CRITERIA.every((c) => found.includes(c))
}

export function validateCiWorkflow(content: string): PipelineValidationResult {
  const missingStages = PIPELINE_STAGES.filter((stage) => {
    const markers = CI_JOB_MARKERS[stage]
    return !markers.every((marker) => content.includes(marker))
  })

  const missingTriggers: string[] = []
  for (const [key, markers] of Object.entries(WORKFLOW_TRIGGER_MARKERS)) {
    if (key === 'rollbackDispatch') continue
    if (!markers.every((m) => content.includes(m))) {
      missingTriggers.push(key)
    }
  }

  return {
    ok: missingStages.length === 0 && missingTriggers.length === 0,
    missingStages,
    missingTriggers,
  }
}

export function validateDeployWorkflow(
  content: string,
  kind: 'staging' | 'production',
): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!content.includes('workflow_dispatch:')) {
    missing.push('workflow_dispatch')
  }
  const hook = kind === 'staging' ? 'RENDER_API_STAGING_HOOK' : 'RENDER_API_PRODUCTION_HOOK'
  if (!content.includes(hook)) {
    missing.push(hook)
  }
  if (kind === 'production' && !content.includes('environment: production')) {
    missing.push('environment: production')
  }
  return { ok: missing.length === 0, missing }
}

export function validateRollbackSupport(
  stagingContent: string,
  productionContent: string,
): boolean {
  return (
    stagingContent.includes('workflow_dispatch:') &&
    productionContent.includes('workflow_dispatch:')
  )
}
