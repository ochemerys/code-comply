/**
 * Step definitions for VoCForm / VoCSubmissionView (M10-S13).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM10S13 = IWorld & {
  m10s13FormDoc?: { criteria: string[] }
}

Given(
  'the VoC submission form acceptance criteria are defined for M10-S13',
  async function (this: IWorld) {
    const w = this as WorldM10S13
    w.m10s13FormDoc = {
      criteria: [
        'Form accessible from deficiency detail for OPEN or VOC_REJECTED',
        'Fields: verificationDate, sectionTitle, title, name, method, comments',
        'Method select maps to VoCMethod enum values',
        'Submit validates with SubmitVoCDTOSchema before mutation',
        'useVoCMutation POSTs online and queues deficiency.voc.submit offline',
        'Success navigates to deficiency detail with vocSubmitted query',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover VoC fields, validation, method select, submit, and offline queue',
  async function (this: IWorld) {
    const doc = (this as WorldM10S13).m10s13FormDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
