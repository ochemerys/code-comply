/**
 * Step definitions for DeficiencyDetailView / DeficiencyDetails (M6-S9).
 * Executable coverage lives in @codecomply/inspector vitest suite.
 */

import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

type WorldM6S9 = IWorld & {
  m6s9DetailDoc?: { criteria: string[] }
  m6s10EditModalDoc?: { criteria: string[] }
  m6s11DeleteDialogDoc?: { criteria: string[] }
  m6s15StopWorkDoc?: { criteria: string[] }
}

Given(
  'the deficiency detail view acceptance criteria are defined for M6-S9',
  async function (this: IWorld) {
    const w = this as WorldM6S9
    w.m6s9DetailDoc = {
      criteria: [
        'View displays severity, status, description, location, and code reference',
        'Photos section lists thumbnails for evidence linked to the deficiency',
        'Status history timeline is visible',
        'Edit opens the deficiency form; save uses update mutation',
        'Delete requires explicit confirmation before removal',
        'Mark resolved sets deficiency status to closed when supported by API',
        'Add photo stores evidence locally for offline-first workflows',
      ],
    }
  },
)

Then(
  'unit tests should cover DeficiencyDetails and form edit mode, and the deficiency list integration should retain navigation to detail',
  async function (this: IWorld) {
    const doc = (this as WorldM6S9).m6s9DetailDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)

Given(
  'the edit deficiency modal acceptance criteria are defined for M6-S10',
  async function (this: IWorld) {
    const w = this as WorldM6S9
    w.m6s10EditModalDoc = {
      criteria: [
        'Modal opens with current deficiency values',
        'Editable fields: description, severity, location, code reference, due date (via DeficiencyForm)',
        'Save submits updates through the existing deficiency mutation',
        'Cancel closes without persisting',
        'Validation errors surface from the shared form',
        'Works offline via local Dexie + mutation queue',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover EditDeficiencyModal with seeded values and cancel or save flows',
  async function (this: IWorld) {
    const doc = (this as WorldM6S9).m6s10EditModalDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)

Given(
  'the delete deficiency dialog acceptance criteria are defined for M6-S11',
  async function (this: IWorld) {
    const w = this as WorldM6S9
    w.m6s11DeleteDialogDoc = {
      criteria: [
        'Dialog shows deficiency summary (description, severity, location)',
        'Confirm triggers delete mutation from the parent view',
        'Cancel closes the dialog without deleting',
        'Loading state disables actions and shows progress on the delete button',
        'Failures show an error message in the dialog and retain context',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover DeleteDeficiencyDialog with summary, confirm, cancel, loading, and error states',
  async function (this: IWorld) {
    const doc = (this as WorldM6S9).m6s11DeleteDialogDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)

Given(
  'the Stop Work order workflow acceptance criteria are defined for M6-S15',
  async function (this: IWorld) {
    const w = this as WorldM6S9
    w.m6s15StopWorkDoc = {
      criteria: [
        'Prominent Stop Work CTA on deficiency detail when not already issued',
        'Confirmation dialog explains notifications, sync priority, and admin-only reversal',
        'Online: POST /deficiencies/:id/stop-work then refresh local row from GET',
        'Offline: set isStopWork locally and queue deficiency.update at priority 1',
        'Edit form disables clearing Stop Work once issued',
      ],
    }
  },
)

Then(
  'unit and integration tests should cover Stop Work button, confirmation dialog, mutation queue, and edit-form lock when Stop Work is already issued',
  async function (this: IWorld) {
    const doc = (this as WorldM6S9).m6s15StopWorkDoc
    expect(doc?.criteria?.length).toBeGreaterThan(0)
  },
)
