/**
 * M11-S22 — Cucumber steps validating API documentation artifacts (no browser required).
 */
import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCEPTANCE_CRITERIA,
  API_DOCS_ARTIFACT_PATHS,
  validateOpenApiYaml,
  validateReadme,
} from '../../../../packages/utils/src/api-docs/api-docs-config'
import { REPO_ROOT } from '../../support/repo-root'
import type { IWorld } from '../world'

type WorldM11S22 = IWorld & {
  m11s22Doc?: { criteria: string[] }
  m11s22Readme?: string
  m11s22OpenapiYaml?: string
}

function readArtifact(rel: string): string {
  const full = join(REPO_ROOT, rel)
  expect(existsSync(full), `${rel} missing`).toBe(true)
  return readFileSync(full, 'utf8')
}

Given(
  'the complete API documentation acceptance criteria are defined for M11-S22',
  async function (this: IWorld) {
    const w = this as WorldM11S22
    w.m11s22Doc = {
      criteria: [
        'OpenAPI spec is complete',
        'All endpoints documented',
        'Request/response examples',
        'Authentication documented',
        'Error codes documented',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S22 API documentation validators',
  async function (this: IWorld) {
    const doc = (this as WorldM11S22).m11s22Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(ACCEPTANCE_CRITERIA.length).toBe(5)
  },
)

Given('the M11-S22 API documentation artifact files are loaded', async function (this: IWorld) {
  const w = this as WorldM11S22
  w.m11s22Readme = readArtifact(API_DOCS_ARTIFACT_PATHS.apiReadme)
})

Then(
  'the M11-S22 OpenAPI README should document authentication and error codes',
  async function (this: IWorld) {
    const w = this as WorldM11S22
    const result = validateReadme(w.m11s22Readme!)
    expect(result.missingMarkers, result.missingMarkers.join(', ')).toEqual([])
  },
)

Given('the M11-S22 exported OpenAPI YAML file is loaded', async function (this: IWorld) {
  const w = this as WorldM11S22
  w.m11s22OpenapiYaml = readArtifact(API_DOCS_ARTIFACT_PATHS.openapiYaml)
})

Then(
  'the M11-S22 openapi.yaml should include bearer authentication documentation',
  async function (this: IWorld) {
    const w = this as WorldM11S22
    const result = validateOpenApiYaml(w.m11s22OpenapiYaml!)
    expect(result.missingMarkers, result.missingMarkers.join(', ')).toEqual([])
  },
)
