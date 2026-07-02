/**
 * Browser E2E for Background Sync tag registration (M3-S4).
 */

import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'
import {
  destroyBackgroundSyncManager,
  initBackgroundSyncAndGetStatus,
  initBackgroundSyncWithoutApiSupport,
  installMockServiceWorkerForBackgroundSync,
} from '../../support/inspector-browser-bridge'

type BackgroundSyncWorld = IWorld & {
  bgSyncStatus?: {
    isSupported: boolean
    isRegistered: boolean
    registeredTags: string[]
    isFallbackActive: boolean
  }
}

After({ tags: '@M3-S4' }, async function (this: IWorld) {
  if (!this.page) return
  try {
    await this.page.evaluate(destroyBackgroundSyncManager)
  } catch {
    /* page may already be closed */
  }
})

Given(
  'the browser has a service worker registration for background sync',
  async function (this: IWorld) {
    await this.page.evaluate(installMockServiceWorkerForBackgroundSync)
  },
)

When('the background sync manager is initialized in the browser', async function (this: IWorld) {
  const w = this as BackgroundSyncWorld
  w.bgSyncStatus = await this.page.evaluate(initBackgroundSyncAndGetStatus)
})

When(
  'a fresh background sync manager is initialized without Background Sync support',
  async function (this: IWorld) {
    const w = this as BackgroundSyncWorld
    const status = await this.page.evaluate(initBackgroundSyncWithoutApiSupport)
    w.bgSyncStatus = {
      isSupported: false,
      isRegistered: status.isRegistered,
      registeredTags: status.registeredTags,
      isFallbackActive: status.isFallbackActive,
    }
  },
)

Given('the browser does not support Background Sync API', async function (this: IWorld) {
  // Support is simulated inside initBackgroundSyncWithoutApiSupport for an isolated manager instance.
})

Then(
  'the following sync tags should be registered:',
  async function (this: IWorld, dataTable: { hashes: () => Array<{ tag: string }> }) {
    const w = this as BackgroundSyncWorld
    expect(w.bgSyncStatus).toBeDefined()
    expect(w.bgSyncStatus!.isSupported).toBe(true)
    expect(w.bgSyncStatus!.isRegistered).toBe(true)

    const expectedTags = dataTable.hashes().map((row) => row.tag)
    for (const tag of expectedTags) {
      expect(w.bgSyncStatus!.registeredTags).toContain(tag)
    }
  },
)

Then('the background sync fallback should be active', async function (this: IWorld) {
  const w = this as BackgroundSyncWorld
  expect(w.bgSyncStatus?.isFallbackActive).toBe(true)
})

Then('no background sync tags should be registered', async function (this: IWorld) {
  const w = this as BackgroundSyncWorld
  expect(w.bgSyncStatus?.isRegistered).toBe(false)
  expect(w.bgSyncStatus?.registeredTags ?? []).toHaveLength(0)
})
