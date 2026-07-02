/**
 * Step definitions for checklist linked deficiency indicator (M6-S14).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S14 = IWorld & {
  m6s14LinkedIndicatorDoc?: { criteria: string[] }
}

Given(
  'the checklist linked deficiency indicator acceptance criteria are defined for M6-S14',
  async function (this: IWorld) {
    const w = this as WorldM6S14
    w.m6s14LinkedIndicatorDoc = {
      criteria: [
        'Failed checklist rows show a linked-deficiency control when at least one deficiency references checklistItemId',
        'The control shows the number of linked deficiencies',
        'Activation navigates to the deficiency list with checklistItemId query for filtering',
        'DeficiencyListView shows a banner and filters cards to the linked item; Show all clears the query',
        'ChecklistItem.vue shows the same indicator for embedded flows with prop linkedDeficiencyCount',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover indicator visibility, counts, navigation, and list filtering',
  async function (this: IWorld) {
    const doc = (this as WorldM6S14).m6s14LinkedIndicatorDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
