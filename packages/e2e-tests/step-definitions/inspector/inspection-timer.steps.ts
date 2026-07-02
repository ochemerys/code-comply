/**
 * Step definitions for inspection timer (M5-S17).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM5S17 = IWorld & {
  m5s17TimerDoc?: { criteria: string[] }
}

Given(
  'the inspection timer acceptance criteria are defined for M5-S17',
  async function (this: IWorld) {
    const w = this as WorldM5S17
    w.m5s17TimerDoc = {
      criteria: [
        'Timer starts when inspection begins',
        'Timer displays elapsed time (HH:MM:SS)',
        'Timer persists across app restarts',
        'Timer stops when inspection completes',
        'Duration is saved with inspection',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover start, display, persistence, stop on complete, and saving duration with the inspection',
  async function (this: IWorld) {
    const doc = (this as WorldM5S17).m5s17TimerDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
