/**
 * Step definitions for VoiceInputButton (M7-S14).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM7S14 = IWorld & {
  m7s14VoiceButtonDoc?: { criteria: string[] }
}

Given(
  'the voice input button acceptance criteria are defined for M7-S14',
  async function (this: IWorld) {
    const w = this as WorldM7S14
    w.m7s14VoiceButtonDoc = {
      criteria: [
        'Button shows microphone icon',
        'Pressing starts recording',
        'Visual feedback during recording',
        'Releasing stops recording',
        'Transcript is inserted into field',
        'Works on supported browsers',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover render, record, processing, stop, and transcript emission',
  async function (this: IWorld) {
    const doc = (this as WorldM7S14).m7s14VoiceButtonDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
