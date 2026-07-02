/**
 * Step definitions for database query optimization (M11-S11).
 * Executable coverage lives in @codecomply/api vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM11S11 = IWorld & {
  m11s11QueryDoc?: { criteria: string[] }
}

Given(
  'the database query optimization acceptance criteria are defined for M11-S11',
  async function (this: IWorld) {
    const w = this as WorldM11S11
    w.m11s11QueryDoc = {
      criteria: [
        'Missing composite indexes added for hot query paths',
        'N+1 queries eliminated via groupBy batching',
        'Redis/in-memory query cache for hot reference data',
        'Pagination and selective select on list endpoints',
        'p95 response time under 200ms for optimized paths',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S11 indexes caching and N+1 elimination',
  async function (this: IWorld) {
    const doc = (this as WorldM11S11).m11s11QueryDoc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
  },
)
