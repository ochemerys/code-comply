/**
 * M7-S18 — Evidence capture, annotation, voice, and mandatory-photo E2E (Playwright + Cucumber).
 * Camera and Speech APIs are stubbed via addInitScript; annotation uses dev-only `e2e-annotate-photo` route.
 */

import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import type { IWorld } from './world'
import { openChecklistExecutionPage, seedChecklistWorkflow } from '../support/checklist-e2e-fixture'

const DEFAULT_VIEWPORT = { width: 1280, height: 720 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }

/** Plain JS string — Playwright addInitScript serializes function sources verbatim and breaks on TS syntax. */
const EVIDENCE_E2E_MEDIA_MOCKS_INIT_SCRIPT = `
(() => {
  const w = window;
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
  }
  navigator.mediaDevices.getUserMedia = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px sans-serif';
      ctx.fillText('E2E mock camera', 32, 250);
    }
    return canvas.captureStream(30);
  };
  class FakeSpeechRecognition {
    constructor() {
      this.continuous = true;
      this.interimResults = true;
      this.lang = 'en-US';
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    emitMockResult() {
      if (!this.onresult) return;
      this.onresult({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: true, 0: { transcript: 'E2E voice note for deficiency description' } },
        },
      });
    }
    start() { this.emitMockResult(); }
    stop() { this.emitMockResult(); if (this.onend) this.onend(); }
    abort() {}
  }
  FakeSpeechRecognition.isE2EMock = true;
  w.SpeechRecognition = FakeSpeechRecognition;
  w.webkitSpeechRecognition = FakeSpeechRecognition;
})();
`

async function installEvidenceE2EMediaMocks(
  context: BrowserContext,
  inspectorOrigin: string,
  page?: Page,
): Promise<void> {
  await context.addInitScript(EVIDENCE_E2E_MEDIA_MOCKS_INIT_SCRIPT)
  if (page) {
    await page.addInitScript(EVIDENCE_E2E_MEDIA_MOCKS_INIT_SCRIPT)
  }
  await context.grantPermissions(['camera'], { origin: inspectorOrigin })
}

async function waitForCameraStreamReady(page: Page): Promise<void> {
  await expect(page.getByTestId('camera-viewfinder')).toBeVisible({ timeout: 20000 })
  await page.waitForFunction(
    () => {
      const video = document.querySelector(
        '[data-testid="camera-viewfinder"]',
      ) as HTMLVideoElement | null
      return Boolean(video?.srcObject)
    },
    { timeout: 20000 },
  )
}

After({ tags: '@M7-S18' }, async function (this: IWorld) {
  if (!this.page) return
  try {
    const ctx = this.page.context()
    await ctx.setOffline(false)
    await this.page.setViewportSize(DEFAULT_VIEWPORT)
  } catch {
    /* context may already be closed */
  }
})

Given('evidence E2E media mocks are installed', async function (this: IWorld) {
  const inspectorOrigin = new URL(this.getInspectorUrl()).origin
  await installEvidenceE2EMediaMocks(this.context, inspectorOrigin, this.page)
})

Given(
  'I have opened the mobile checklist execution page for inspection {string} and execution {string}',
  async function (this: IWorld, inspectionId: string, executionId: string) {
    await openChecklistExecutionPage(this, `${inspectionId}:${executionId}`, MOBILE_VIEWPORT)
  },
)

When(
  'I capture and accept a photo from the gallery on checklist item {string}',
  async function (this: IWorld, itemId: string) {
    const item = this.page.getByTestId(`checklist-item-${itemId}`)
    await item.getByTestId('photo-gallery-add').click()
    await expect(this.page.getByTestId('capture-photo-view')).toBeVisible({ timeout: 20000 })
    await waitForCameraStreamReady(this.page)
    await expect(this.page.getByTestId('camera-shutter')).toBeEnabled({ timeout: 20000 })
    await this.page.getByTestId('camera-shutter').click()
    await expect(this.page.getByTestId('camera-preview')).toBeVisible({ timeout: 15000 })
    await this.page.getByTestId('camera-accept').click()
    await expect(this.page.getByTestId('checklist-execution-view')).toBeVisible({ timeout: 20000 })
    await expect(this.page.getByTestId('checklist-progress-percent')).toContainText('100%', {
      timeout: 20000,
    })
    await expect(item.getByTestId('photo-thumbnail').first()).toBeVisible({ timeout: 20000 })
  },
)

Then(
  'checklist item {string} photo gallery should show at least one thumbnail',
  async function (this: IWorld, itemId: string) {
    const item = this.page.getByTestId(`checklist-item-${itemId}`)
    await expect(item.getByTestId('photo-gallery-grid')).toBeVisible({ timeout: 15000 })
    await expect(item.getByTestId('photo-thumbnail').first()).toBeVisible()
  },
)

Then('the complete inspection button should be disabled', async function (this: IWorld) {
  await expect(this.page.getByTestId('checklist-complete-inspection')).toBeDisabled()
})

Then('the complete inspection button should be enabled', async function (this: IWorld) {
  await expect(this.page.getByTestId('checklist-mandatory-photo-banner')).toHaveCount(0, {
    timeout: 20000,
  })
  await expect(this.page.getByTestId('checklist-progress-percent')).toContainText('100%', {
    timeout: 20000,
  })
  await expect(this.page.getByTestId('checklist-complete-inspection')).toBeEnabled({
    timeout: 20000,
  })
})

Then('the mandatory photo banner should not be visible', async function (this: IWorld) {
  await expect(this.page.getByTestId('checklist-mandatory-photo-banner')).toHaveCount(0)
})

Given('I navigate to the dev annotation screen', async function (this: IWorld) {
  await this.page.setViewportSize(MOBILE_VIEWPORT)
  await this.page.goto(`${this.getInspectorUrl()}/e2e-annotate-photo`)
  await expect(this.page.getByTestId('e2e-annotate-photo-root')).toBeVisible({ timeout: 20000 })
  await expect(this.page.getByTestId('photo-annotator')).toBeVisible({ timeout: 20000 })
})

When('I draw an arrow annotation and save', async function (this: IWorld) {
  await this.page.getByTestId('annotation-tool-arrow').click()
  const canvas = this.page.getByTestId('annotation-canvas')
  await expect(canvas).toBeVisible({ timeout: 15000 })
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  const startX = box!.x + 40
  const startY = box!.y + Math.min(120, box!.height * 0.35)
  const endX = box!.x + Math.min(220, box!.width - 20)
  const endY = box!.y + Math.min(160, box!.height * 0.45)
  await this.page.mouse.move(startX, startY)
  await this.page.mouse.down()
  await this.page.mouse.move(endX, endY)
  await this.page.mouse.up()
  await this.page.getByTestId('annotation-save').click()
})

Then('the annotation save confirmation should be visible', async function (this: IWorld) {
  await expect(this.page.getByTestId('e2e-annotate-photo-saved')).toBeVisible({ timeout: 20000 })
})

Given(
  'I open the create deficiency form for inspection {string}',
  async function (this: IWorld, inspectionId: string) {
    const inspectorOrigin = new URL(this.getInspectorUrl()).origin
    await installEvidenceE2EMediaMocks(this.context, inspectorOrigin, this.page)
    const prisma = this.testDb.getClient()
    const workflow = await seedChecklistWorkflow(prisma, `m7-voice:${inspectionId}`)
    await this.page.setViewportSize(MOBILE_VIEWPORT)
    await this.page.goto(
      `${this.getInspectorUrl()}/inspections/${encodeURIComponent(workflow.inspectionId)}/deficiencies/new`,
    )
    await expect(this.page.getByTestId('deficiency-form')).toBeVisible({ timeout: 20000 })
  },
)

When('I dictate notes using the voice input control', async function (this: IWorld) {
  const mockProbe = await this.page.evaluate(() => {
    const w = window as Window & {
      SpeechRecognition?: new () => unknown & { isE2EMock?: boolean }
    }
    const Ctor = w.SpeechRecognition
    if (!Ctor) return { ok: false as const, reason: 'SpeechRecognition missing' }
    if (!(Ctor as unknown as { isE2EMock?: boolean }).isE2EMock) {
      return { ok: false as const, reason: 'native SpeechRecognition still active' }
    }
    const rec = new Ctor() as {
      onresult: ((ev: unknown) => void) | null
      start: () => void
      stop: () => void
    }
    let text = ''
    rec.onresult = (ev) => {
      const results = (ev as { results: { 0: { 0: { transcript: string } } } }).results
      text = results[0][0].transcript
    }
    rec.start()
    rec.stop()
    return { ok: true as const, text }
  })
  expect(mockProbe.ok, mockProbe.ok ? '' : mockProbe.reason).toBe(true)
  if (mockProbe.ok) {
    expect(mockProbe.text).toContain('E2E voice note for deficiency description')
  }

  const btn = this.page.getByTestId('voice-input-button')
  await expect(btn).toBeEnabled()
  await btn.dispatchEvent('pointerdown')
  await expect(this.page.getByTestId('voice-input-recording')).toBeVisible({ timeout: 5000 })
  await btn.dispatchEvent('pointerup')
  await expect(this.page.getByTestId('deficiency-description')).toHaveValue(
    /E2E voice note for deficiency description/,
    { timeout: 15000 },
  )
})

Then(
  'the deficiency description should include the dictated phrase',
  async function (this: IWorld) {
    await expect(this.page.getByTestId('deficiency-description')).toHaveValue(
      /E2E voice note for deficiency description/,
    )
  },
)

Then(
  'captured evidence should appear in the checklist gallery for item {string}',
  async function (this: IWorld, itemId: string) {
    const item = this.page.getByTestId(`checklist-item-${itemId}`)
    const count = item.getByTestId('photo-gallery-count')
    await expect(count).toContainText('(1)', { timeout: 15000 })
  },
)
