/**
 * Browser E2E for IndexedDB encryption at rest (M3-S2).
 */

import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'
import {
  readDecryptedFieldThroughApp,
  readRawFieldAtRest,
  storeDeficiencyLocally,
  storeInspectionLocally,
  waitForEncryptionInitialized,
  type StoredEntityRef,
} from '../../support/inspector-browser-bridge'

type EncryptionWorld = IWorld & {
  storedEntity?: StoredEntityRef
}

Given('the inspector encryption session is ready', async function (this: IWorld) {
  await this.page.waitForFunction(waitForEncryptionInitialized, undefined, { timeout: 45_000 })
})

When('I store an inspection note {string} locally', async function (this: IWorld, notes: string) {
  const w = this as EncryptionWorld
  const inspectionId = `e2e-enc-insp-${Date.now()}`
  w.storedEntity = { table: 'inspections', id: inspectionId, sensitiveField: 'notes' }

  await this.page.evaluate(storeInspectionLocally, { inspectionId, notes })
})

When(
  'I store an inspection with status {string} and notes {string} locally',
  async function (this: IWorld, status: string, notes: string) {
    const w = this as EncryptionWorld
    const inspectionId = `e2e-enc-insp-status-${Date.now()}`
    w.storedEntity = {
      table: 'inspections',
      id: inspectionId,
      sensitiveField: 'notes',
      plaintextField: 'status',
    }

    await this.page.evaluate(storeInspectionLocally, { inspectionId, notes, status })
  },
)

When(
  'I store a deficiency description {string} locally',
  async function (this: IWorld, description: string) {
    const w = this as EncryptionWorld
    const deficiencyId = `e2e-enc-def-${Date.now()}`
    w.storedEntity = { table: 'deficiencies', id: deficiencyId, sensitiveField: 'description' }

    await this.page.evaluate(storeDeficiencyLocally, { deficiencyId, description })
  },
)

Then(
  'the raw IndexedDB notes field must not contain {string}',
  async function (this: IWorld, plaintext: string) {
    const entity = (this as EncryptionWorld).storedEntity
    expect(entity?.sensitiveField).toBe('notes')

    const raw = await this.page.evaluate(readRawFieldAtRest, {
      table: entity!.table,
      id: entity!.id,
      field: 'notes',
    })

    expect(raw).toBeTruthy()
    expect(raw).not.toContain(plaintext)
  },
)

Then(
  'the raw IndexedDB description field must not contain {string}',
  async function (this: IWorld, plaintext: string) {
    const entity = (this as EncryptionWorld).storedEntity
    expect(entity?.sensitiveField).toBe('description')

    const raw = await this.page.evaluate(readRawFieldAtRest, {
      table: entity!.table,
      id: entity!.id,
      field: 'description',
    })

    expect(raw).toBeTruthy()
    expect(raw).not.toContain(plaintext)
  },
)

Then('the raw IndexedDB notes field should be encrypted', async function (this: IWorld) {
  const entity = (this as EncryptionWorld).storedEntity
  const raw = await this.page.evaluate(readRawFieldAtRest, {
    table: entity!.table,
    id: entity!.id,
    field: 'notes',
  })

  expect(raw).toMatch(/^enc:v[12]:/)
})

Then('the raw IndexedDB description field should be encrypted', async function (this: IWorld) {
  const entity = (this as EncryptionWorld).storedEntity
  const raw = await this.page.evaluate(readRawFieldAtRest, {
    table: entity!.table,
    id: entity!.id,
    field: 'description',
  })

  expect(raw).toMatch(/^enc:v[12]:/)
})

Then(
  'reading the inspection through the app returns notes {string}',
  async function (this: IWorld, expected: string) {
    const entity = (this as EncryptionWorld).storedEntity
    const notes = await this.page.evaluate(readDecryptedFieldThroughApp, {
      table: entity!.table,
      id: entity!.id,
      field: 'notes',
    })

    expect(notes).toBe(expected)
  },
)

Then(
  'reading the deficiency through the app returns description {string}',
  async function (this: IWorld, expected: string) {
    const entity = (this as EncryptionWorld).storedEntity
    const description = await this.page.evaluate(readDecryptedFieldThroughApp, {
      table: entity!.table,
      id: entity!.id,
      field: 'description',
    })

    expect(description).toBe(expected)
  },
)

Then(
  'the raw IndexedDB status field should equal {string}',
  async function (this: IWorld, status: string) {
    const entity = (this as EncryptionWorld).storedEntity
    const raw = await this.page.evaluate(readRawFieldAtRest, {
      table: entity!.table,
      id: entity!.id,
      field: 'status',
    })

    expect(raw).toBe(status)
  },
)
