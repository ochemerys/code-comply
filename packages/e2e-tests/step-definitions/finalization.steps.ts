import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'
import type { IWorld } from './world'

type FinalizationWorld = IWorld & {
  m8s14?: {
    inspectionId: string
    checklistId: string
  }
}

/** Playwright route glob for REST calls to the configured API (matches `VITE_API_URL` + `/api/...`). */
function apiRequestGlobForOfflineSimulation(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, '')
  const href = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `http://${trimmed}`
  const { origin } = new URL(href)
  return `${origin}/api/**`
}

type LocalInspection = {
  id: string
  clientId: string
  permitId: string
  permitNumber?: string
  permitAddress?: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'CANCELLED'
  scheduledDate: string
  completedDate?: string
  assignedToId: string
  outcome?: 'ACCEPTABLE' | 'ACCEPTABLE_WITH_CONDITIONS' | 'REFUSED'
  signatureDataUrl?: string
  certificationSnapshot?: string
  createdAt: string
  updatedAt: string
  syncedAt?: string
  isDirty: boolean
}

type LocalChecklist = {
  id: string
  inspectionId: string
  templateId: string
  versionHash: string
  templateName: string
  discipline: string
  items: Array<{
    id: string
    description: string
    order: number
    isRequired: boolean
    requiresPhotoOnFail: boolean
    category?: string
  }>
  progress: number
  createdAt: string
  updatedAt: string
  isDirty: boolean
}

type LocalChecklistResponse = {
  id: string
  checklistId: string
  itemId: string
  result: 'PASS' | 'FAIL' | 'NA'
  respondedAt: string
  updatedAt: string
}

async function seedInspectorDbInBrowser(seed: any) {
  const { inspection, checklist, responses } = seed
  const db = (await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('InspectorDB')
    req.onupgradeneeded = () => {
      const upgradingDb = req.result
      if (!upgradingDb.objectStoreNames.contains('inspections')) {
        upgradingDb.createObjectStore('inspections', { keyPath: 'id' })
      }
      if (!upgradingDb.objectStoreNames.contains('checklists')) {
        upgradingDb.createObjectStore('checklists', { keyPath: 'id' })
      }
      if (!upgradingDb.objectStoreNames.contains('checklistResponses')) {
        upgradingDb.createObjectStore('checklistResponses', { keyPath: 'id' })
      }
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })) as IDBDatabase

  const tx = db.transaction(['inspections', 'checklists', 'checklistResponses'], 'readwrite')
  const put = (storeName: string, value: unknown) =>
    new Promise<void>((resolve, reject) => {
      const req = tx.objectStore(storeName).put(value)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve()
    })

  await put('inspections', inspection)
  await put('checklists', checklist)
  for (const r of responses) {
    await put('checklistResponses', r)
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

  db.close()
}

async function markInspectionFinalizedAndSyncedInBrowser(args: any) {
  const { inspectionId, isoNow } = args
  const db = (await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('InspectorDB')
    req.onupgradeneeded = () => {
      const upgradingDb = req.result
      if (!upgradingDb.objectStoreNames.contains('inspections')) {
        upgradingDb.createObjectStore('inspections', { keyPath: 'id' })
      }
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })) as IDBDatabase

  const tx = db.transaction(['inspections'], 'readwrite')
  const store = tx.objectStore('inspections')

  const existing = await new Promise<unknown>((resolve, reject) => {
    const req = store.get(inspectionId)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
  })

  if (existing) {
    const updated = {
      ...(existing as Record<string, unknown>),
      status: 'PASSED',
      completedDate: isoNow,
      syncedAt: isoNow,
      isDirty: false,
    }
    await new Promise<void>((resolve, reject) => {
      const req = store.put(updated)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve()
    })
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

  db.close()
}

async function seedInspectorIndexedDb(
  page: FinalizationWorld['page'],
  seed: {
    inspection: LocalInspection
    checklist: LocalChecklist
    responses: LocalChecklistResponse[]
  },
): Promise<void> {
  // Some build pipelines inject `__name()` helper calls into function bodies.
  // Ensure it exists in the browser context so Playwright `page.evaluate` callbacks don't crash.
  await page.evaluate(() => {
    ;(globalThis as any).__name = (x: any) => x
  })

  await page.evaluate(seedInspectorDbInBrowser, seed)
}

Given('I have a locally cached inspection ready for finalization', async function (this: IWorld) {
  const w = this as FinalizationWorld

  const now = new Date()
  const iso = now.toISOString()

  // Keep IDs deterministic for stable assertions.
  const inspectionId = 'e2e-inspection-finalization-1'
  const checklistId = 'e2e-checklist-finalization-1'

  w.m8s14 = { inspectionId, checklistId }

  const inspection: LocalInspection = {
    id: inspectionId,
    clientId: 'e2e-client-insp-1',
    permitId: 'e2e-permit-1',
    permitNumber: 'BP-E2E-0001',
    permitAddress: '123 Test St, Edmonton',
    status: 'SCHEDULED',
    scheduledDate: iso,
    assignedToId: 'test-inspector',
    createdAt: iso,
    updatedAt: iso,
    isDirty: false,
  }

  const items = [
    {
      id: 'item-1',
      description: 'E2E checklist item 1',
      order: 1,
      isRequired: true,
      requiresPhotoOnFail: false,
      category: 'General',
    },
    {
      id: 'item-2',
      description: 'E2E checklist item 2',
      order: 2,
      isRequired: true,
      requiresPhotoOnFail: false,
      category: 'General',
    },
  ]

  const checklist: LocalChecklist = {
    id: checklistId,
    inspectionId,
    templateId: 'e2e-template-1',
    versionHash: 'e2e-version-hash-1',
    templateName: 'E2E Template',
    discipline: 'Building',
    items,
    progress: 1,
    createdAt: iso,
    updatedAt: iso,
    isDirty: false,
  }

  const responses: LocalChecklistResponse[] = items.map((it) => ({
    id: `resp-${it.id}`,
    checklistId,
    itemId: it.id,
    result: 'PASS',
    respondedAt: iso,
    updatedAt: iso,
  }))

  // Ensure we’re on the app origin before touching IndexedDB.
  await w.page.goto(w.getInspectorUrl())
  await seedInspectorIndexedDb(w.page, { inspection, checklist, responses })
})

Given('the cached inspection is marked finalized and synced', async function (this: IWorld) {
  const w = this as FinalizationWorld
  const ids = w.m8s14
  expect(ids?.inspectionId).toBeTruthy()

  const iso = new Date().toISOString()

  await w.page.evaluate(markInspectionFinalizedAndSyncedInBrowser, {
    inspectionId: ids!.inspectionId,
    isoNow: iso,
  })
})

When('I open the inspection review screen', async function (this: IWorld) {
  const w = this as FinalizationWorld
  const ids = w.m8s14
  expect(ids?.inspectionId).toBeTruthy()
  expect(ids?.checklistId).toBeTruthy()

  await w.page.goto(
    `${w.getInspectorUrl()}/inspections/${encodeURIComponent(
      ids!.inspectionId,
    )}/review?executionId=${encodeURIComponent(ids!.checklistId)}`,
  )
  await expect(w.page.getByTestId('inspection-review-view')).toBeVisible()
})

Then('the submit inspection action should be disabled', async function (this: IWorld) {
  const w = this as FinalizationWorld
  await expect(w.page.getByTestId('inspection-review-submit')).toBeDisabled()
})

Then(
  'I should see the finalization validation message {string}',
  async function (this: IWorld, message: string) {
    const w = this as FinalizationWorld
    await expect(w.page.getByText(message)).toBeVisible()
  },
)

When('I select the inspection outcome {string}', async function (this: IWorld, outcome: string) {
  const w = this as FinalizationWorld
  await w.page.getByTestId(`outcome-option-${outcome}`).click()
})

Then(
  'the outcome option {string} should be selected',
  async function (this: IWorld, outcome: string) {
    const w = this as FinalizationWorld
    // The label contains a hidden radio input; asserting checked is reliable.
    await expect(
      w.page.locator(`[data-testid="outcome-option-${outcome}"] input[type="radio"]`),
    ).toBeChecked()
  },
)

When('I draw a signature and accept it', async function (this: IWorld) {
  const w = this as FinalizationWorld

  await w.page.getByTestId('inspection-review-signature-open').click()
  await expect(w.page.getByTestId('inspection-review-signature-sheet')).toBeVisible({
    timeout: 20000,
  })

  const canvas = w.page.getByTestId('signature-canvas')
  await canvas.scrollIntoViewIfNeeded()
  await expect(canvas).toBeVisible({ timeout: 20000 })

  const box = await canvas.boundingBox()
  if (!box) throw new Error('Signature canvas bounding box not available')

  await w.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5)
  await w.page.mouse.down()
  await w.page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.3, { steps: 8 })
  await w.page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 8 })
  await w.page.mouse.up()

  const acceptBtn = w.page.getByTestId('signature-accept')
  await expect(acceptBtn).toBeEnabled({ timeout: 10000 })
  await acceptBtn.click()
})

Then('I should see the signature preview attached', async function (this: IWorld) {
  const w = this as FinalizationWorld
  await expect(w.page.getByTestId('inspection-review-signature-preview')).toBeVisible()
})

Then('I should see the inspection offline warning', async function (this: IWorld) {
  const w = this as FinalizationWorld
  await expect(w.page.getByText(/Submission is queued when offline/i)).toBeVisible()
})

When('I simulate being offline', async function (this: IWorld) {
  const w = this as FinalizationWorld
  const apiGlob = apiRequestGlobForOfflineSimulation(w.getApiUrl())
  await w.page.context().setOffline(true)
  await w.page.unroute(apiGlob).catch(() => {})
  await w.page.route(apiGlob, (route: Route) => {
    void route.abort()
  })
  await w.page.evaluate(() => {
    window.dispatchEvent(new Event('offline'))
  })
})

When('I submit the inspection finalization confirmation', async function (this: IWorld) {
  const w = this as FinalizationWorld
  await w.page.getByTestId('inspection-review-submit').click()
  await expect(w.page.getByTestId('finalization-confirm-dialog')).toBeVisible()
  await w.page.getByTestId('finalization-confirm-ok').click()
})

Then('I should see a submission success result', async function (this: IWorld) {
  const w = this as FinalizationWorld
  const ids = w.m8s14
  await expect(w.page.getByTestId('submission-result')).toBeVisible()
  await expect(w.page.getByTestId('submission-result-title')).toContainText(
    'Inspection submitted successfully',
  )
  if (ids?.inspectionId) {
    await expect(w.page.getByTestId('submission-result-inspection-id')).toContainText(
      ids.inspectionId,
    )
  }
})

Then('I should see the inspection read-only banner', async function (this: IWorld) {
  const w = this as FinalizationWorld
  await expect(w.page.getByTestId('inspection-read-only-banner')).toBeVisible()
})
