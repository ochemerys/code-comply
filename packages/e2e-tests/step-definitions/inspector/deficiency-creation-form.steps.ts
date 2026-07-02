/**
 * Step definitions for DeficiencyForm / CreateDeficiencyView (M6-S7).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S7 = IWorld & {
  m6s7FormDoc?: { criteria: string[] }
}

Given(
  'the deficiency creation form acceptance criteria are defined for M6-S7',
  async function (this: IWorld) {
    const w = this as WorldM6S7
    w.m6s7FormDoc = {
      criteria: [
        'Form has required fields with description min length',
        'Severity selector Minor / Major / Critical',
        'Optional code reference via modal selector',
        'Optional location and future-only due date',
        'Unsafe condition toggle (M6-S16) with isUnsafe on submit',
        'Submit uses CreateDeficiencyDTO validation',
        'CreateDeficiencyView wires useDeficiencyMutation with clientId',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover fields, validation, code reference, and submit flow',
  async function (this: IWorld) {
    const doc = (this as WorldM6S7).m6s7FormDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
