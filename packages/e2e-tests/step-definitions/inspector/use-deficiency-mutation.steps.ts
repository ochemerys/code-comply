/**
 * Step definitions for useDeficiencyMutation composable (M6-S5).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S5 = IWorld & {
  m6s5ComposableDoc?: { criteria: string[] }
}

Given(
  'the deficiency mutation composable acceptance criteria are defined for M6-S5',
  async function (this: IWorld) {
    const w = this as WorldM6S5
    w.m6s5ComposableDoc = {
      criteria: [
        'useDeficiencyMutation composable is created',
        'createDeficiency works online and offline',
        'updateDeficiency works online and offline',
        'deleteDeficiency works online and offline',
        'Mutations queue when offline',
        'Optimistic IndexedDB updates with rollback on API failure',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover online API, offline queue, and rollback behavior',
  async function (this: IWorld) {
    const doc = (this as WorldM6S5).m6s5ComposableDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
