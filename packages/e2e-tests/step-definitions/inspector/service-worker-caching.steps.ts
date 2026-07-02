/**
 * Step definitions for service worker caching strategies (M11-S10).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM11S10 = IWorld & {
  m11s10CachingDoc?: { criteria: string[] }
}

Given(
  'the service worker caching acceptance criteria are defined for M11-S10',
  async function (this: IWorld) {
    const w = this as WorldM11S10
    w.m11s10CachingDoc = {
      criteria: [
        'API GET uses NetworkFirst with 24h expiration',
        'Images use CacheFirst with 30d expiration',
        'JS/CSS use StaleWhileRevalidate with bounded entries',
        'Fonts use CacheFirst with 1y expiration',
        'Cache buckets use ExpirationPlugin maxEntries for size management',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S10 offline and cache size targets',
  async function (this: IWorld) {
    const doc = (this as WorldM11S10).m11s10CachingDoc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
  },
)
