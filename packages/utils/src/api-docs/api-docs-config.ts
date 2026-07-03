/**
 * M11-S22 — Complete API documentation acceptance criteria and validators.
 * See scripts/openapi-audit.mjs and _docs/internal/development/03-implementation/m11-s22-api-documentation-checklist.md.
 */

export const API_DOCS_STORY_ID = 'M11-S22'

export const DOCUMENTATION_SECTIONS = [
  'Authentication',
  'Inspections',
  'Deficiencies',
  'Documents',
  'Reports',
  'Admin',
] as const

export type DocumentationSection = (typeof DOCUMENTATION_SECTIONS)[number]

export const ACCEPTANCE_CRITERIA = [
  'openapi-spec-complete',
  'all-endpoints-documented',
  'request-response-examples',
  'authentication-documented',
  'error-codes-documented',
] as const

export type AcceptanceCriterion = (typeof ACCEPTANCE_CRITERIA)[number]

/** HTTP error codes documented across the API */
export const DOCUMENTED_ERROR_CODES = [400, 401, 403, 404, 409, 413, 500, 503] as const

export type DocumentedErrorCode = (typeof DOCUMENTED_ERROR_CODES)[number]

/** Repository paths that must exist for M11-S22 */
export const API_DOCS_ARTIFACT_PATHS = {
  openapiYaml: 'apps/api/openapi.yaml',
  apiReadme: '_docs/api/README.md',
  openapiSpecTest: 'apps/api/__tests__/openapi.spec.ts',
  apiDocsConfig: 'packages/utils/src/api-docs/api-docs-config.ts',
  apiDocsConfigSpec: 'packages/utils/src/api-docs/api-docs-config.spec.ts',
  integrationSpec: 'packages/utils/__tests__/integration/api-docs-scenarios.integration.spec.ts',
  exportScript: 'scripts/export-openapi.mjs',
  auditScript: 'scripts/openapi-audit.mjs',
  checklist: '_docs/internal/development/03-implementation/m11-s22-api-documentation-checklist.md',
  e2eFeature: 'packages/e2e-tests/features/ci/api-documentation.feature',
  e2eSteps: 'packages/e2e-tests/step-definitions/ci/api-documentation.steps.ts',
} as const

/** OpenAPI paths that must appear in the live spec (method → path) */
export const REQUIRED_OPENAPI_OPERATIONS: ReadonlyArray<{
  path: string
  method: 'get' | 'post' | 'patch' | 'delete'
  tag: string
}> = [
  { path: '/health', method: 'get', tag: 'Health' },
  { path: '/auth/login', method: 'post', tag: 'Authentication' },
  { path: '/auth/refresh', method: 'post', tag: 'Authentication' },
  { path: '/auth/logout', method: 'post', tag: 'Authentication' },
  { path: '/auth/me', method: 'get', tag: 'Authentication' },
  { path: '/api/sync/push', method: 'post', tag: 'Sync' },
  { path: '/api/sync/pull', method: 'get', tag: 'Sync' },
  { path: '/api/permits', method: 'get', tag: 'Permits' },
  { path: '/api/permits/nearby', method: 'get', tag: 'Permits' },
  { path: '/api/permits/assigned', method: 'get', tag: 'Permits' },
  { path: '/api/permits/{id}', method: 'get', tag: 'Permits' },
  { path: '/api/inspections', method: 'get', tag: 'Inspections' },
  { path: '/api/inspections/{id}', method: 'get', tag: 'Inspections' },
  { path: '/api/inspections/{id}/start', method: 'post', tag: 'Inspections' },
  { path: '/api/inspections/{id}/finalize', method: 'post', tag: 'Inspections' },
  { path: '/api/checklists/templates', method: 'get', tag: 'Checklists' },
  { path: '/api/checklists/executions', method: 'post', tag: 'Checklists' },
  { path: '/api/codes', method: 'get', tag: 'Codes' },
  { path: '/api/codes/{code}/{section}', method: 'get', tag: 'Codes' },
  { path: '/api/deficiencies', method: 'get', tag: 'Deficiencies' },
  { path: '/api/deficiencies', method: 'post', tag: 'Deficiencies' },
  { path: '/api/deficiencies/{id}', method: 'get', tag: 'Deficiencies' },
  { path: '/api/documents', method: 'post', tag: 'Documents' },
  { path: '/api/documents/{id}/url', method: 'get', tag: 'Documents' },
  { path: '/api/documents/{id}', method: 'delete', tag: 'Documents' },
  { path: '/api/reports/generate', method: 'post', tag: 'Reports' },
  { path: '/api/reports/{id}/download', method: 'get', tag: 'Reports' },
  { path: '/api/voc/pending', method: 'get', tag: 'VoC' },
  { path: '/api/voc/{id}/review', method: 'post', tag: 'VoC' },
  { path: '/api/photos', method: 'post', tag: 'Photos' },
  { path: '/api/photos/{id}', method: 'delete', tag: 'Photos' },
  { path: '/api/admin/users', method: 'get', tag: 'Admin' },
  { path: '/api/admin/assignments', method: 'post', tag: 'Admin' },
  { path: '/api/admin/compliance-search', method: 'get', tag: 'Admin' },
]

export const README_MARKERS = [
  'Authentication',
  'Bearer',
  'Inspections',
  'Deficiencies',
  'Documents',
  'Reports',
  'Admin',
  'Error',
  '401',
  '403',
  '404',
  'openapi.yaml',
  '/swagger',
] as const

export const OPENAPI_YAML_MARKERS = [
  'openapi:',
  '3.0',
  'paths:',
  'Authentication',
  'bearerAuth',
] as const

export const CHECKLIST_MARKERS = [
  'OpenAPI',
  'Swagger',
  'Authentication',
  'Error',
  'export-openapi',
  'M11-S22',
] as const

export interface ApiDocsValidationResult {
  ok: boolean
  missingMarkers: string[]
}

export interface OpenApiSpecValidationResult {
  ok: boolean
  missingOperations: string[]
  missingTags: string[]
  missingSecurity: boolean
  missingExamples: boolean
}

export function coversAllAcceptanceCriteria(found: readonly string[]): boolean {
  return ACCEPTANCE_CRITERIA.every((c) => found.includes(c))
}

export function validateFileMarkers(
  content: string,
  markers: readonly string[],
): ApiDocsValidationResult {
  const missingMarkers = markers.filter((m) => !content.includes(m))
  return { ok: missingMarkers.length === 0, missingMarkers }
}

export function validateReadme(content: string): ApiDocsValidationResult {
  return validateFileMarkers(content, README_MARKERS)
}

export function validateOpenApiYaml(content: string): ApiDocsValidationResult {
  return validateFileMarkers(content, OPENAPI_YAML_MARKERS)
}

export function validateChecklist(content: string): ApiDocsValidationResult {
  return validateFileMarkers(content, CHECKLIST_MARKERS)
}

/** Validate a parsed OpenAPI JSON object from GET /openapi.json */
export function validateLiveOpenApiSpec(spec: {
  openapi?: string
  paths?: Record<string, Record<string, unknown>>
  tags?: Array<{ name: string }>
  components?: { securitySchemes?: Record<string, unknown> }
}): OpenApiSpecValidationResult {
  const paths = spec.paths ?? {}
  const missingOperations: string[] = []

  for (const op of REQUIRED_OPENAPI_OPERATIONS) {
    const pathItem = paths[op.path]
    if (!pathItem?.[op.method]) {
      missingOperations.push(`${op.method.toUpperCase()} ${op.path}`)
    }
  }

  const tagNames = new Set((spec.tags ?? []).map((t) => t.name))
  const requiredTags = [...new Set(REQUIRED_OPENAPI_OPERATIONS.map((o) => o.tag))]
  const missingTags = requiredTags.filter((t) => !tagNames.has(t))

  const missingSecurity = !spec.components?.securitySchemes?.bearerAuth

  const loginPath = paths['/auth/login']?.post as
    | { requestBody?: { content?: Record<string, { example?: unknown }> } }
    | undefined
  const loginExample = loginPath?.requestBody?.content?.['application/json']?.example !== undefined
  const missingExamples = !loginExample

  return {
    ok:
      missingOperations.length === 0 &&
      missingTags.length === 0 &&
      !missingSecurity &&
      !missingExamples &&
      spec.openapi === '3.0.0',
    missingOperations,
    missingTags,
    missingSecurity,
    missingExamples,
  }
}

/** Check that documented error response codes appear in at least one operation */
export function validateErrorCodesDocumented(spec: {
  paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>
}): ApiDocsValidationResult {
  const documented = new Set<number>()
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (!operation?.responses) continue
      for (const code of Object.keys(operation.responses)) {
        const n = parseInt(code, 10)
        if (!Number.isNaN(n)) documented.add(n)
      }
    }
  }
  const missingMarkers = DOCUMENTED_ERROR_CODES.filter((c) => !documented.has(c)).map(String)
  return { ok: missingMarkers.length === 0, missingMarkers }
}
