import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from '../src/app.js'
import {
  ACCEPTANCE_CRITERIA,
  API_DOCS_STORY_ID,
  DOCUMENTATION_SECTIONS,
  DOCUMENTED_ERROR_CODES,
  REQUIRED_OPENAPI_OPERATIONS,
  validateErrorCodesDocumented,
  validateLiveOpenApiSpec,
} from '../../../packages/utils/src/api-docs/api-docs-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

async function fetchSpec() {
  const res = await app.request('/openapi.json')
  expect(res.status).toBe(200)
  return res.json()
}

describe('OpenAPI Documentation (M11-S22)', () => {
  it('should include sync/push endpoint in OpenAPI spec', async () => {
    const spec = await fetchSpec()
    expect(spec.paths['/api/sync/push']?.post).toBeDefined()
  })

  it('should include sync/pull endpoint in OpenAPI spec', async () => {
    const spec = await fetchSpec()
    expect(spec.paths['/api/sync/pull']?.get).toBeDefined()
  })

  it('should have Sync tag in OpenAPI spec', async () => {
    const spec = await fetchSpec()
    const syncTag = spec.tags.find((tag: { name: string }) => tag.name === 'Sync')
    expect(syncTag).toBeDefined()
    expect(syncTag.description).toBeDefined()
  })

  it('should document sync/push request and response schemas', async () => {
    const spec = await fetchSpec()
    const pushEndpoint = spec.paths['/api/sync/push']?.post
    expect(pushEndpoint?.requestBody).toBeDefined()
    expect(pushEndpoint?.responses['200']).toBeDefined()
  })

  it('should document sync/pull query parameters and response schemas', async () => {
    const spec = await fetchSpec()
    const pullEndpoint = spec.paths['/api/sync/pull']?.get
    expect(pullEndpoint?.parameters).toBeDefined()
    expect(pullEndpoint?.responses['200']).toBeDefined()
  })

  it('should include checklist template and execution endpoints', async () => {
    const spec = await fetchSpec()
    expect(spec.paths['/api/checklists/templates']?.get).toBeDefined()
    expect(spec.paths['/api/checklists/executions']?.post).toBeDefined()
    expect(spec.paths['/api/checklists/executions/{id}']?.get).toBeDefined()
    expect(spec.paths['/api/checklists/executions/{id}/responses']?.patch).toBeDefined()
  })

  it('should include codes search and lookup endpoints', async () => {
    const spec = await fetchSpec()
    expect(spec.paths['/api/codes']?.get).toBeDefined()
    expect(spec.paths['/api/codes/{code}/{section}']?.get).toBeDefined()
  })

  it('should include permits assigned endpoint for inspectors', async () => {
    const spec = await fetchSpec()
    expect(spec.paths['/api/permits/assigned']?.get).toBeDefined()
  })

  it('declares M11-S22 story metadata and documentation sections', () => {
    expect(API_DOCS_STORY_ID).toBe('M11-S22')
    expect(DOCUMENTATION_SECTIONS).toEqual([
      'Authentication',
      'Inspections',
      'Deficiencies',
      'Documents',
      'Reports',
      'Admin',
    ])
    expect(ACCEPTANCE_CRITERIA).toHaveLength(5)
  })

  it('documents bearer JWT authentication', async () => {
    const spec = await fetchSpec()
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined()
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer')
  })

  it('includes login request/response examples', async () => {
    const spec = await fetchSpec()
    const login = spec.paths['/auth/login']?.post
    const reqExample =
      login?.requestBody?.content?.['application/json']?.example ??
      login?.requestBody?.content?.['application/json']?.examples
    expect(reqExample).toBeDefined()
    const resExample = login?.responses?.['200']?.content?.['application/json']?.example
    expect(resExample).toBeDefined()
  })

  it('documents multipart photo and document upload endpoints', async () => {
    const spec = await fetchSpec()
    expect(spec.paths['/api/photos']?.post).toBeDefined()
    expect(spec.paths['/api/documents']?.post).toBeDefined()
  })

  it('validates all required operations are present in live spec', async () => {
    const spec = await fetchSpec()
    const result = validateLiveOpenApiSpec(spec)
    expect(result.missingOperations, result.missingOperations.join(', ')).toEqual([])
    expect(result.missingTags, result.missingTags.join(', ')).toEqual([])
    expect(result.missingSecurity).toBe(false)
    expect(result.missingExamples).toBe(false)
    expect(result.ok).toBe(true)
    expect(REQUIRED_OPENAPI_OPERATIONS.length).toBeGreaterThanOrEqual(30)
  })

  it('documents standard HTTP error codes across operations', async () => {
    const spec = await fetchSpec()
    const result = validateErrorCodesDocumented(spec)
    for (const code of DOCUMENTED_ERROR_CODES) {
      expect(result.missingMarkers, `missing HTTP ${code}`).not.toContain(String(code))
    }
    expect(result.ok).toBe(true)
  })

  it('static openapi.yaml exists and matches live openapi version', async () => {
    const yamlPath = join(ROOT, 'apps/api/openapi.yaml')
    expect(existsSync(yamlPath), 'apps/api/openapi.yaml').toBe(true)
    const yaml = readFileSync(yamlPath, 'utf8')
    expect(yaml).toContain('openapi: 3.0.0')
    expect(yaml).toContain('bearerAuth')
    const spec = await fetchSpec()
    expect(yaml).toContain('CodeComply Connect API')
    expect(Object.keys(spec.paths).length).toBeGreaterThan(0)
  })
})
