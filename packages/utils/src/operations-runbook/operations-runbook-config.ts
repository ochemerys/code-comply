/**
 * M11-S24 — Operations runbook acceptance criteria and validators.
 * See scripts/operations-runbook-audit.mjs and _docs/internal/development/03-implementation/m11-s24-operations-runbook-checklist.md.
 */

export const OPERATIONS_RUNBOOK_STORY_ID = 'M11-S24'

export const RUNBOOK_SECTIONS = [
  'Deployment',
  'Rollback',
  'Database Operations',
  'Incident Response',
  'Monitoring',
  'Contacts',
] as const

export type RunbookSection = (typeof RUNBOOK_SECTIONS)[number]

export const ACCEPTANCE_CRITERIA = [
  'deployment-procedures-documented',
  'rollback-procedures-documented',
  'incident-response-documented',
  'monitoring-procedures-documented',
  'contact-information-included',
] as const

export type AcceptanceCriterion = (typeof ACCEPTANCE_CRITERIA)[number]

/** Repository paths that must exist for M11-S24 */
export const OPERATIONS_RUNBOOK_ARTIFACT_PATHS = {
  runbook: '_docs/internal/operations/runbook.md',
  incidentResponse: '_docs/internal/operations/incident-response.md',
  operationsRunbookConfig: 'packages/utils/src/operations-runbook/operations-runbook-config.ts',
  operationsRunbookConfigSpec:
    'packages/utils/src/operations-runbook/operations-runbook-config.spec.ts',
  integrationSpec:
    'packages/utils/__tests__/integration/operations-runbook-scenarios.integration.spec.ts',
  auditScript: 'scripts/operations-runbook-audit.mjs',
  checklist: '_docs/internal/development/03-implementation/m11-s24-operations-runbook-checklist.md',
  e2eFeature: 'packages/e2e-tests/features/ci/operations-runbook.feature',
  e2eSteps: 'packages/e2e-tests/step-definitions/ci/operations-runbook.steps.ts',
} as const

export const RUNBOOK_MARKERS = [
  'Deployment',
  'Rollback',
  'Database Operations',
  'Incident Response',
  'Monitoring',
  'Contacts',
  'Manual Production Deploy',
  'migrate:deploy',
  'curl',
  '/health',
  'oncall@example.com',
  'M11-S24',
] as const

export const INCIDENT_RESPONSE_MARKERS = [
  'SEV-1',
  'SEV-2',
  'Incident Commander',
  'Post-incident review',
  'Rollback',
  'security@example.com',
  'oncall@example.com',
  'M11-S24',
] as const

export const CHECKLIST_MARKERS = [
  'Deployment',
  'Rollback',
  'Incident Response',
  'Monitoring',
  'Contacts',
  'operations-runbook-audit',
  'M11-S24',
] as const

export interface OperationsRunbookValidationResult {
  ok: boolean
  missingMarkers: string[]
}

export function coversAllAcceptanceCriteria(found: readonly string[]): boolean {
  return ACCEPTANCE_CRITERIA.every((c) => found.includes(c))
}

export function validateFileMarkers(
  content: string,
  markers: readonly string[],
): OperationsRunbookValidationResult {
  const missingMarkers = markers.filter((m) => !content.includes(m))
  return { ok: missingMarkers.length === 0, missingMarkers }
}

export function validateRunbook(content: string): OperationsRunbookValidationResult {
  return validateFileMarkers(content, RUNBOOK_MARKERS)
}

export function validateIncidentResponse(content: string): OperationsRunbookValidationResult {
  return validateFileMarkers(content, INCIDENT_RESPONSE_MARKERS)
}

export function validateChecklist(content: string): OperationsRunbookValidationResult {
  return validateFileMarkers(content, CHECKLIST_MARKERS)
}

/** Validate that all required runbook sections appear as headings */
export function validateRunbookSections(content: string): OperationsRunbookValidationResult {
  const missingMarkers = RUNBOOK_SECTIONS.filter((section) => !content.includes(section))
  return { ok: missingMarkers.length === 0, missingMarkers }
}
