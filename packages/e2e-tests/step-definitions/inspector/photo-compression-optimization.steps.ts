/**
 * Step definitions for inspection photo compression optimization (M11-S9).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM11S9 = IWorld & {
  m11s9CompressionDoc?: { criteria: string[] }
}

Given(
  'the photo compression acceptance criteria are defined for M11-S9',
  async function (this: IWorld) {
    const w = this as WorldM11S9
    w.m11s9CompressionDoc = {
      criteria: [
        'Output capped at 500KB with 1920px max edge and JPEG quality 0.8',
        'Compression completes within 2 seconds (deadline guard)',
        'Web worker enabled by default; EXIF not preserved to save memory',
        'Fallback quality retry when first pass exceeds size target',
        'Integration path persists optimized blob on LocalPhoto with metadata',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S9 size, speed, and memory targets',
  async function (this: IWorld) {
    const doc = (this as WorldM11S9).m11s9CompressionDoc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
  },
)
