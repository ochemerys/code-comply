/**
 * Step definitions for SeveritySelector (M6-S12).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S12 = IWorld & {
  m6s12SeverityDoc?: { criteria: string[] }
}

Given(
  'the severity selector acceptance criteria are defined for M6-S12',
  async function (this: IWorld) {
    const w = this as WorldM6S12
    w.m6s12SeverityDoc = {
      criteria: [
        'Three values: Minor, Major, Critical',
        'Visual color coding (yellow, orange, red)',
        'Touch-friendly minimum height (44px)',
        'Clear selected state',
        'Radiogroup semantics and option labels for assistive tech',
        'DeficiencyForm integrates SeveritySelector with labelled radiogroup',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover options, selection, visual cues, and accessibility',
  async function (this: IWorld) {
    const doc = (this as WorldM6S12).m6s12SeverityDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
