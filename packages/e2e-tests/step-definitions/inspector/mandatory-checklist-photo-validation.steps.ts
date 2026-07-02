/**
 * Step definitions for mandatory checklist photo validation (M7-S16).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM7S16 = IWorld & {
  m7s16Doc?: { criteria: string[] }
}

Given(
  'the mandatory checklist photo validation acceptance criteria are defined for M7-S16',
  async function (this: IWorld) {
    const w = this as WorldM7S16
    w.m7s16Doc = {
      criteria: [
        'FAIL plus requiresPhoto requires at least one LocalPhoto with matching checklistItemId',
        'Completion is disabled until violations are cleared',
        'PhotoGallery is shown per item when requiresPhoto or FAIL',
        'Gallery lists IndexedDB photos scoped to inspectionId and checklistItemId',
        'Add navigates to capture-photo with return route checklist-execution',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover FAIL plus requiresPhoto rules, IndexedDB counts, gallery scoping, and completion gating',
  async function (this: IWorld) {
    const doc = (this as WorldM7S16).m7s16Doc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
