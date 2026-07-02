import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_CRITERIA,
  OPERATIONS_RUNBOOK_ARTIFACT_PATHS,
  OPERATIONS_RUNBOOK_STORY_ID,
  RUNBOOK_SECTIONS,
  coversAllAcceptanceCriteria,
  validateChecklist,
  validateIncidentResponse,
  validateRunbook,
  validateRunbookSections,
} from './operations-runbook-config'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function readRepoFile(rel: string): string {
  const full = join(ROOT, rel)
  expect(existsSync(full), `${rel} should exist`).toBe(true)
  return readFileSync(full, 'utf8')
}

describe('operations-runbook-config (M11-S24)', () => {
  it('declares story id and runbook sections', () => {
    expect(OPERATIONS_RUNBOOK_STORY_ID).toBe('M11-S24')
    expect(RUNBOOK_SECTIONS).toHaveLength(6)
    expect(RUNBOOK_SECTIONS).toContain('Deployment')
    expect(RUNBOOK_SECTIONS).toContain('Contacts')
  })

  it('covers acceptance criteria helpers', () => {
    expect(coversAllAcceptanceCriteria([...ACCEPTANCE_CRITERIA])).toBe(true)
    expect(coversAllAcceptanceCriteria(['deployment-procedures-documented'])).toBe(false)
    expect(ACCEPTANCE_CRITERIA).toHaveLength(5)
  })

  it('validates runbook, incident response, and checklist markers', () => {
    const runbook = readRepoFile(OPERATIONS_RUNBOOK_ARTIFACT_PATHS.runbook)
    const incident = readRepoFile(OPERATIONS_RUNBOOK_ARTIFACT_PATHS.incidentResponse)
    const checklist = readRepoFile(OPERATIONS_RUNBOOK_ARTIFACT_PATHS.checklist)
    expect(validateRunbook(runbook).missingMarkers).toEqual([])
    expect(validateRunbookSections(runbook).missingMarkers).toEqual([])
    expect(validateIncidentResponse(incident).missingMarkers).toEqual([])
    expect(validateChecklist(checklist).missingMarkers).toEqual([])
  })
})
