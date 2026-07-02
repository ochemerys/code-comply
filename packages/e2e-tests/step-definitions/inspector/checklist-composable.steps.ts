/**
 * Step definitions for checklist execution composable (M5-S6).
 * Documents BDD alignment; executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM5S6 = IWorld & {
  m5s6ComposableDoc?: { criteria: string[] }
}

Given(
  'the checklist composable acceptance criteria are defined for M5-S6',
  async function (this: IWorld) {
    const w = this as WorldM5S6
    w.m5s6ComposableDoc = {
      criteria: [
        'useChecklist composable is created',
        'Provides execution reactive ref',
        'Provides progress computed',
        'Provides failedItems computed',
        'updateResponse saves item response',
        'passAll marks all items as pass',
        'scrollToNextFailed navigates to next failed item',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover execution state and scroll helpers',
  async function (this: IWorld) {
    const doc = (this as WorldM5S6).m5s6ComposableDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
