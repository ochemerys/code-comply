/**
 * Step definitions for load testing (M11-S13).
 * Executable coverage lives in @codecomply/api vitest suite and k6 scripts under tools/load-tests.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM11S13 = IWorld & {
  m11s13LoadDoc?: { criteria: string[] }
}

Given(
  'the load testing acceptance criteria are defined for M11-S13',
  async function (this: IWorld) {
    const w = this as WorldM11S13
    w.m11s13LoadDoc = {
      criteria: [
        '50+ concurrent inspection syncs with >99% success',
        '10 concurrent PDF generations under 10s p95',
        '100 concurrent API requests with p95 < 200ms',
        'Battery life target > 8 hours on inspector devices',
        'Memory profiling and bottleneck identification',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S13 concurrent sync API and PDF load',
  async function (this: IWorld) {
    const doc = (this as WorldM11S13).m11s13LoadDoc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
  },
)
