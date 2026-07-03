/**
 * M11-S22 — Integration coverage linking API documentation acceptance criteria to on-disk artifacts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../../src/test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  API_DOCS_ARTIFACT_PATHS,
  validateChecklist,
  validateOpenApiYaml,
  validateReadme,
} from '../../src/api-docs/api-docs-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe.runIf(runComplianceTests)('API documentation scenarios integration (M11-S22)', () => {
  it('maps acceptance criteria to API docs artifacts on disk', () => {
    for (const rel of Object.values(API_DOCS_ARTIFACT_PATHS)) {
      if (rel === API_DOCS_ARTIFACT_PATHS.openapiYaml) continue
      expect(existsSync(join(ROOT, rel)), rel).toBe(true)
    }
    expect(ACCEPTANCE_CRITERIA).toContain('authentication-documented')
    expect(ACCEPTANCE_CRITERIA).toContain('error-codes-documented')
  })

  it('validates README, checklist, and export scripts', () => {
    const readme = readFileSync(join(ROOT, API_DOCS_ARTIFACT_PATHS.apiReadme), 'utf8')
    const checklist = readFileSync(join(ROOT, API_DOCS_ARTIFACT_PATHS.checklist), 'utf8')
    const exportScript = readFileSync(join(ROOT, API_DOCS_ARTIFACT_PATHS.exportScript), 'utf8')
    const auditScript = readFileSync(join(ROOT, API_DOCS_ARTIFACT_PATHS.auditScript), 'utf8')
    expect(validateReadme(readme).ok).toBe(true)
    expect(validateChecklist(checklist).ok).toBe(true)
    expect(exportScript).toContain('export-openapi')
    expect(auditScript).toContain('M11-S22')
  })

  it('validates openapi.yaml when exported', () => {
    const yamlPath = join(ROOT, API_DOCS_ARTIFACT_PATHS.openapiYaml)
    if (!existsSync(yamlPath)) return
    const yaml = readFileSync(yamlPath, 'utf8')
    expect(validateOpenApiYaml(yaml).ok).toBe(true)
  })
})
