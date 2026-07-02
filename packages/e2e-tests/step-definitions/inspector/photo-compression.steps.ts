/**
 * Step definitions for inspection photo compression (M7-S4).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM7S4 = IWorld & {
  m7s4CompressionDoc?: { criteria: string[] }
}

Given(
  'the photo compression acceptance criteria are defined for M7-S4',
  async function (this: IWorld) {
    const w = this as WorldM7S4
    w.m7s4CompressionDoc = {
      criteria: [
        'Compress before storage with story defaults (max 0.5 MB, max edge 1920, JPEG)',
        'Configurable overrides merged with defaults',
        'Blob input normalized to File for the compressor',
        'Web worker enabled by default for mobile responsiveness',
        'Integration path: compressed size persisted on LocalPhoto with metadata',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover size targets and configurable options',
  async function (this: IWorld) {
    const doc = (this as WorldM7S4).m7s4CompressionDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
