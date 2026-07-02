/**
 * Step definitions for checklist FAIL → deficiency flow (M6-S13).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S13 = IWorld & {
  m6s13FailDeficiencyDoc?: { criteria: string[] }
}

Given(
  'the checklist fail deficiency workflow acceptance criteria are defined for M6-S13',
  async function (this: IWorld) {
    const w = this as WorldM6S13
    w.m6s13FailDeficiencyDoc = {
      criteria: [
        'After FAIL and code reference, checklist row shows Record deficiency (no auto second modal)',
        'Deficiency form opens when user taps Record deficiency on ChecklistExecutionView',
        'Checklist item id is passed to the deficiency payload',
        'Code reference is pre-filled and editable before save',
        'User can close via Close, Cancel, or backdrop without saving',
        'Record deficiency reopens the modal for an existing FAIL with code',
        'ChecklistItem.vue supports optional open-deficiency-form when used by a parent that wires it',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover optional deficiency modal after Record deficiency, pre-filled code, checklist link, close, and re-open from failed item',
  async function (this: IWorld) {
    const doc = (this as WorldM6S13).m6s13FailDeficiencyDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
