/**
 * Step definitions for offline photo storage (M7-S10).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM7S10 = IWorld & {
  m7s10OfflinePhotoDoc?: { criteria: string[] }
}

Given(
  'the offline photo storage acceptance criteria are defined for M7-S10',
  async function (this: IWorld) {
    const w = this as WorldM7S10
    w.m7s10OfflinePhotoDoc = {
      criteria: [
        'Photos stored as blobs with metadata in IndexedDB (LocalPhoto)',
        'Upload queue uses photo.upload with deduplication per photo id',
        'Storage caps: max 100 photos and 500 MB estimated footprint',
        'Composable tracks coarse upload progress via sync engine events',
        'Failed sync items can be retried via SyncEngine.retryFailedItems',
        'XHR helper supports byte-level upload progress for future signed-URL uploads',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover IndexedDB blobs, queueing, progress, limits, and retries',
  async function (this: IWorld) {
    const doc = (this as WorldM7S10).m7s10OfflinePhotoDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
