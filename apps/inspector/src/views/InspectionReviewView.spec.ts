import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import InspectionReviewView from './InspectionReviewView.vue'
import { db } from '@/lib/db/dexie'
import { apiFetch } from '@/utils/api-error-handler'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeader', template: '<header data-testid="mock-header" />' },
}))

vi.mock('@/components/PhotoGallery.vue', () => ({
  default: { name: 'PhotoGallery', template: '<section data-testid="photo-gallery-stub" />' },
}))

vi.mock('@/components/SignaturePad.vue', () => ({
  __esModule: true,
  default: defineComponent({
    name: 'SignaturePad',
    emits: ['signed'],
    template:
      '<button type="button" data-testid="signature-stub" @click="$emit(\'signed\', \'data:image/png;base64,AAA\')">Sign</button>',
  }),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function createRouterForReview() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/inspections/:inspectionId/review',
        name: 'inspection-review',
        component: InspectionReviewView,
      },
      {
        path: '/inspections/:inspectionId/checklist/:executionId',
        name: 'checklist-execution',
        component: { template: '<div data-testid="stub-checklist-exec" />' },
      },
      {
        path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
        name: 'deficiency-detail',
        component: { template: '<div data-testid="stub-deficiency-detail" />' },
      },
    ],
  })
}

describe('InspectionReviewView', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    queryClient = createTestQueryClient()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    await db.syncQueue.clear()
    await db.checklistResponses.clear()
    await db.checklists.clear()
    await db.deficiencies.clear()
    await db.photos.clear()
    await db.inspections.clear()
    vi.mocked(apiFetch).mockResolvedValue(new Response('Not found', { status: 404 }))
  })

  it('shows validation errors and disables submit until outcome+signature+checklist complete', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-1',
      clientId: 'c-1',
      permitId: 'perm-1',
      permitNumber: 'BP-2026-001',
      permitAddress: '100 Test St',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'u-1',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklists.put({
      id: 'chk-1',
      inspectionId: 'insp-1',
      templateId: 'tpl-1',
      versionHash: 'vh-1',
      templateName: 'T',
      discipline: 'General',
      items: [
        { id: 'i1', description: 'A', order: 1, isRequired: true, requiresPhotoOnFail: false },
      ],
      progress: 100,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    // No responses -> unanswered=1

    const router = createRouterForReview()
    await router.push({ name: 'inspection-review', params: { inspectionId: 'insp-1' } })
    await router.isReady()

    const wrapper = mount(InspectionReviewView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="inspection-summary"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )

    expect(wrapper.find('[data-testid="inspection-review-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="validation-errors"]').exists()).toBe(true)
    const btn = wrapper.find('[data-testid="inspection-review-submit"]')
      .element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('navigates to checklist with executionId from query when Back is clicked', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-back-q',
      clientId: 'c-bq',
      permitId: 'perm-bq',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'u-1',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklists.put({
      id: 'chk-local',
      inspectionId: 'insp-back-q',
      templateId: 'tpl-1',
      versionHash: 'vh-1',
      templateName: 'T',
      discipline: 'General',
      items: [
        { id: 'i1', description: 'A', order: 1, isRequired: true, requiresPhotoOnFail: false },
      ],
      progress: 0,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })

    const router = createRouterForReview()
    const pushSpy = vi.spyOn(router, 'push')
    await router.push({
      name: 'inspection-review',
      params: { inspectionId: 'insp-back-q' },
      query: { executionId: 'exec-from-query', fromPermit: 'perm-123' },
    })
    await router.isReady()

    const wrapper = mount(InspectionReviewView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="inspection-review-back-checklist"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )

    await wrapper.find('[data-testid="inspection-review-back-checklist"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenLastCalledWith({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-back-q', executionId: 'exec-from-query' },
      query: { fromPermit: 'perm-123' },
    })
  })

  it('navigates to checklist with hydrated checklist id when query has no executionId', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-back-l',
      clientId: 'c-bl',
      permitId: 'perm-bl',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'u-1',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklists.put({
      id: 'exec-from-db',
      inspectionId: 'insp-back-l',
      templateId: 'tpl-1',
      versionHash: 'vh-1',
      templateName: 'T',
      discipline: 'General',
      items: [
        { id: 'i1', description: 'A', order: 1, isRequired: true, requiresPhotoOnFail: false },
      ],
      progress: 100,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })

    const router = createRouterForReview()
    const pushSpy = vi.spyOn(router, 'push')
    await router.push({ name: 'inspection-review', params: { inspectionId: 'insp-back-l' } })
    await router.isReady()

    const wrapper = mount(InspectionReviewView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="inspection-review-back-checklist"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )

    await wrapper.find('[data-testid="inspection-review-back-checklist"]').trigger('click')
    await flushPromises()

    expect(pushSpy).toHaveBeenLastCalledWith({
      name: 'checklist-execution',
      params: { inspectionId: 'insp-back-l', executionId: 'exec-from-db' },
      query: {},
    })
  })

  it('queues finalize when form is valid and submit is clicked', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-2',
      clientId: 'c-2',
      permitId: 'perm-2',
      permitNumber: 'BP-2026-002',
      permitAddress: '200 Test St',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'u-2',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklists.put({
      id: 'chk-2',
      inspectionId: 'insp-2',
      templateId: 'tpl-2',
      versionHash: 'vh-2',
      templateName: 'T',
      discipline: 'General',
      items: [
        { id: 'i1', description: 'A', order: 1, isRequired: true, requiresPhotoOnFail: false },
      ],
      progress: 100,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklistResponses.put({
      id: 'r-1',
      checklistId: 'chk-2',
      itemId: 'i1',
      result: 'PASS',
      respondedAt: now,
      updatedAt: now,
      isDirty: false,
    })

    // Provide a geolocation implementation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success: any) =>
          success({ coords: { latitude: 53.5, longitude: -113.5, accuracy: 10 } }),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
      configurable: true,
    })

    const router = createRouterForReview()
    await router.push({ name: 'inspection-review', params: { inspectionId: 'insp-2' } })
    await router.isReady()

    const wrapper = mount(InspectionReviewView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="inspection-summary"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )

    // Pick outcome (set radio)
    await wrapper.find('input[type="radio"][value="ACCEPTABLE"]').setValue()
    await flushPromises()

    // Attach signature via the sheet-hosted stub (async SignaturePad chunk)
    await wrapper.find('[data-testid="inspection-review-signature-open"]').trigger('click')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="signature-stub"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )
    await wrapper.find('[data-testid="signature-stub"]').trigger('click')
    await flushPromises()

    await vi.waitFor(
      () => {
        const btn = wrapper.find('[data-testid="inspection-review-submit"]')
          .element as HTMLButtonElement
        expect(btn.disabled).toBe(false)
      },
      { timeout: 2000 },
    )

    await wrapper.find('[data-testid="inspection-review-submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="finalization-confirm-dialog"]').exists()).toBe(true)
    await wrapper.get('[data-testid="finalization-confirm-ok"]').trigger('click')
    await flushPromises()

    await vi.waitFor(
      async () => {
        const queued = await db.syncQueue.where('operation').equals('inspection.finalize').toArray()
        expect(queued.length).toBe(1)
      },
      { timeout: 2000 },
    )

    const updated = await db.inspections.get('insp-2')
    expect(updated?.outcome).toBe('ACCEPTABLE')
    expect(updated?.signatureDataUrl).toContain('data:image/png')
    expect(updated?.finalizeLatitude).toBe(53.5)
    expect(updated?.finalizeLongitude).toBe(-113.5)

    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="submission-result"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )
    expect(wrapper.find('[data-testid="submission-result-title"]').text()).toContain(
      'Inspection submitted successfully',
    )
    expect(wrapper.find('[data-testid="submission-result-inspection-id"]').text()).toContain(
      'insp-2',
    )
  })

  it('shows read-only banner and disables submit when finalized inspection is synced (M8-S10)', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-ro',
      clientId: 'c-ro',
      permitId: 'perm-ro',
      permitNumber: 'BP-2026-RO',
      permitAddress: '300 Test St',
      status: 'PASSED',
      scheduledDate: now,
      completedDate: now,
      outcome: 'ACCEPTABLE',
      signatureDataUrl: 'data:image/png;base64,AAA',
      assignedToId: 'u-ro',
      createdAt: now,
      updatedAt: now,
      syncedAt: now,
      isDirty: false,
    })
    await db.checklists.put({
      id: 'chk-ro',
      inspectionId: 'insp-ro',
      templateId: 'tpl-ro',
      versionHash: 'vh-ro',
      templateName: 'T',
      discipline: 'General',
      items: [
        { id: 'i1', description: 'A', order: 1, isRequired: true, requiresPhotoOnFail: false },
      ],
      progress: 100,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
      syncedAt: now,
    })
    await db.checklistResponses.put({
      id: 'r-ro',
      checklistId: 'chk-ro',
      itemId: 'i1',
      result: 'PASS',
      respondedAt: now,
      updatedAt: now,
      isDirty: false,
      syncedAt: now,
    })

    const router = createRouterForReview()
    await router.push({ name: 'inspection-review', params: { inspectionId: 'insp-ro' } })
    await router.isReady()

    const wrapper = mount(InspectionReviewView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()

    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="inspection-read-only-banner"]').exists()).toBe(true)
      },
      { timeout: 2000 },
    )

    const btn = wrapper.find('[data-testid="inspection-review-submit"]')
      .element as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('lists mandatory photo and unanswered item validation with checklist deep links (VC-FINAL-01)', async () => {
    const now = new Date().toISOString()
    await db.inspections.put({
      id: 'insp-final-01',
      clientId: 'c-f1',
      permitId: 'perm-f1',
      status: 'IN_PROGRESS',
      scheduledDate: now,
      assignedToId: 'u-1',
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklists.put({
      id: 'chk-final-01',
      inspectionId: 'insp-final-01',
      templateId: 'tpl-1',
      versionHash: 'vh-1',
      templateName: 'T',
      discipline: 'General',
      items: [
        {
          id: 'item-unanswered',
          description: 'Anchor bolt spacing',
          order: 1,
          isRequired: true,
          requiresPhotoOnFail: false,
        },
        {
          id: 'item-fail',
          description: 'Rebar cover over top mat',
          order: 2,
          isRequired: true,
          requiresPhotoOnFail: true,
        },
      ],
      progress: 50,
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    })
    await db.checklistResponses.put({
      id: 'resp-fail',
      checklistId: 'chk-final-01',
      itemId: 'item-fail',
      result: 'FAIL',
      respondedAt: now,
      updatedAt: now,
    })

    const router = createRouterForReview()
    await router.push({
      name: 'inspection-review',
      params: { inspectionId: 'insp-final-01' },
      query: { executionId: 'chk-final-01' },
    })
    await router.isReady()

    const wrapper = mount(InspectionReviewView, {
      global: {
        plugins: [router, createPinia(), [VueQueryPlugin, { queryClient }]],
        stubs: { teleport: true },
      },
    })
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.text()).toContain('Missing answer: Anchor bolt spacing')
      },
      { timeout: 2000 },
    )

    expect(wrapper.text()).toContain('Mandatory photo missing: Rebar cover over top mat')
    expect(wrapper.find('[data-testid="validation-error-link-0"]').exists()).toBe(true)

    await wrapper.find('[data-testid="validation-error-link-0"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('checklist-execution')
    expect(router.currentRoute.value.hash).toBe('#checklist-item-item-unanswered')
  })
})
