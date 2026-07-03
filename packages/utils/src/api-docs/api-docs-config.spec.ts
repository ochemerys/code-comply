import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runComplianceTests } from '../test/compliance-profile'
import {
  ACCEPTANCE_CRITERIA,
  API_DOCS_ARTIFACT_PATHS,
  API_DOCS_STORY_ID,
  DOCUMENTATION_SECTIONS,
  coversAllAcceptanceCriteria,
  validateChecklist,
  validateOpenApiYaml,
  validateReadme,
} from './api-docs-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function readRepoFile(rel: string): string {
  const full = join(ROOT, rel)
  expect(existsSync(full), `${rel} should exist`).toBe(true)
  return readFileSync(full, 'utf8')
}

describe('api-docs-config (M11-S22)', () => {
  it('declares story id and documentation sections', () => {
    expect(API_DOCS_STORY_ID).toBe('M11-S22')
    expect(DOCUMENTATION_SECTIONS).toHaveLength(6)
    expect(DOCUMENTATION_SECTIONS).toContain('Authentication')
    expect(DOCUMENTATION_SECTIONS).toContain('Admin')
  })

  it('covers acceptance criteria helpers', () => {
    expect(coversAllAcceptanceCriteria([...ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllAcceptanceCriteria(['openapi-spec-complete'])).toBe(false)
    expect(ACCEPTANCE_CRITERIA).toHaveLength(5)
  })

  it('validates API README markers', () => {
    const readme = readRepoFile(API_DOCS_ARTIFACT_PATHS.apiReadme)
    expect(validateReadme(readme).missingMarkers).toEqual([])
  })

  describe.runIf(runComplianceTests)('internal repository artifacts', () => {
    it('validates implementation checklist markers', () => {
      const checklist = readRepoFile(API_DOCS_ARTIFACT_PATHS.checklist)
      expect(validateChecklist(checklist).missingMarkers).toEqual([])
    })
  })

  it('validates exported openapi.yaml markers when present', () => {
    const yamlPath = join(ROOT, API_DOCS_ARTIFACT_PATHS.openapiYaml)
    if (!existsSync(yamlPath)) {
      expect(true).toBe(true)
      return
    }
    const yaml = readFileSync(yamlPath, 'utf8')
    expect(validateOpenApiYaml(yaml).missingMarkers).toEqual([])
  })
})
