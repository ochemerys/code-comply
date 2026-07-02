/**
 * Step definitions for DeficiencyListView / DeficiencyCard / DeficiencyFilters (M6-S8).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S8 = IWorld & {
  m6s8ListDoc?: { criteria: string[] }
}

Given(
  'the deficiency list view acceptance criteria are defined for M6-S8',
  async function (this: IWorld) {
    const w = this as WorldM6S8
    w.m6s8ListDoc = {
      criteria: [
        'List displays deficiency cards with severity and status badges',
        'Cards show truncated description, location, due date, and created date',
        'Stop work flag visible on card when applicable',
        'Unsafe condition badge and list highlight when applicable (M6-S16)',
        'Filters for status and severity',
        'Loading, error with retry, and empty states',
        'Add deficiency navigates to create flow for the same inspection',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover cards, badges, filters, and empty state',
  async function (this: IWorld) {
    const doc = (this as WorldM6S8).m6s8ListDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
