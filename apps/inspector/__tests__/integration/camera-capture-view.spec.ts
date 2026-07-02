/**
 * Integration — CapturePhotoView + CameraCapture (M7-S11): accept navigates with history state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import CapturePhotoView from '@/views/CapturePhotoView.vue'
import { clearPendingAcceptedPhoto, consumeLastAcceptedPhoto } from '@/lib/photo/last-capture'

const mockStart = vi.fn()
const mockCapture = vi.fn()
const mockStop = vi.fn()
const mockToggle = vi.fn()
const stream = ref<MediaStream | null>(null)
const photo = ref<Blob | null>(null)
const isCapturing = ref(false)
const error = ref<Error | null>(null)

vi.mock('@/composables/usePhotoCapture', () => ({
  usePhotoCapture: () => ({
    stream,
    photo,
    isCapturing,
    error,
    startCamera: mockStart,
    capturePhoto: mockCapture,
    stopCamera: mockStop,
    toggleFacingMode: mockToggle,
  }),
}))

vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: defineComponent({
    name: 'AppHeader',
    template: '<header data-testid="app-header-stub" />',
  }),
}))

describe('CapturePhotoView integration (M7-S11)', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    clearPendingAcceptedPhoto()
    pinia = createPinia()
    setActivePinia(pinia)
    vi.clearAllMocks()
    mockStart.mockResolvedValue(undefined)
    mockStop.mockResolvedValue(undefined)
    mockToggle.mockResolvedValue(undefined)
    stream.value = {
      getTracks: () => [],
      getVideoTracks: () => [{ getCapabilities: () => ({}) } as unknown as MediaStreamTrack],
    } as unknown as MediaStream
    photo.value = null
    error.value = null
  })

  it('navigates home with captured blob in history state on accept', async () => {
    const Home = defineComponent({ template: '<div data-testid="home-stub" />' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/capture-photo', name: 'capture-photo', component: CapturePhotoView },
        { path: '/', name: 'home', component: Home },
      ],
    })
    await router.push({ name: 'capture-photo' })

    const jpeg = new Blob(['evidence'], { type: 'image/jpeg' })
    mockCapture.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })

    const wrapper = mount(CapturePhotoView, { global: { plugins: [router, pinia] } })
    await flushPromises()

    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="camera-accept"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
    const handedOff = consumeLastAcceptedPhoto()
    expect(handedOff).toBeInstanceOf(Blob)
    expect(handedOff?.size).toBe(jpeg.size)
  })

  it('uses return query route name when registered', async () => {
    const Permits = defineComponent({ template: '<div data-testid="permits-stub" />' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/capture-photo', name: 'capture-photo', component: CapturePhotoView },
        { path: '/permits', name: 'permits', component: Permits },
        { path: '/', name: 'home', component: defineComponent({ template: '<div />' }) },
      ],
    })
    await router.push({ name: 'capture-photo', query: { return: 'permits' } })

    const jpeg = new Blob(['x'], { type: 'image/jpeg' })
    mockCapture.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })

    const wrapper = mount(CapturePhotoView, { global: { plugins: [router, pinia] } })
    await flushPromises()
    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="camera-accept"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('permits')
    expect(consumeLastAcceptedPhoto()).toBe(jpeg)
  })

  it('M7-S11-B1: accept navigates to checklist-execution with inspection and execution params from query', async () => {
    const ChecklistStub = defineComponent({ template: '<div data-testid="checklist-stub" />' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/capture-photo', name: 'capture-photo', component: CapturePhotoView },
        {
          path: '/inspections/:inspectionId/checklist/:executionId',
          name: 'checklist-execution',
          component: ChecklistStub,
        },
        { path: '/', name: 'home', component: defineComponent({ template: '<div />' }) },
      ],
    })
    await router.push({
      name: 'capture-photo',
      query: {
        return: 'checklist-execution',
        inspectionId: 'insp-bug',
        executionId: 'exec-bug',
        checklistItemId: 'line-bug',
        fromPermit: 'perm-keep',
      },
    })

    const jpeg = new Blob(['evidence'], { type: 'image/jpeg' })
    mockCapture.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })

    const wrapper = mount(CapturePhotoView, { global: { plugins: [router, pinia] } })
    await flushPromises()
    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="camera-accept"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('checklist-execution')
    expect(router.currentRoute.value.params).toEqual({
      inspectionId: 'insp-bug',
      executionId: 'exec-bug',
    })
    expect(router.currentRoute.value.query.fromPermit).toBe('perm-keep')
    expect(consumeLastAcceptedPhoto('line-bug')).toBe(jpeg)
  })

  it('M7-I1: accept replaces to deficiency-detail with route params when return says so', async () => {
    const DefStub = defineComponent({ template: '<div data-testid="def-detail-stub" />' })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/capture-photo', name: 'capture-photo', component: CapturePhotoView },
        {
          path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
          name: 'deficiency-detail',
          component: DefStub,
        },
        { path: '/', name: 'home', component: defineComponent({ template: '<div />' }) },
      ],
    })
    await router.push({
      name: 'capture-photo',
      query: {
        return: 'deficiency-detail',
        inspectionId: 'insp-d',
        deficiencyId: 'def-d',
      },
    })

    const jpeg = new Blob(['e'], { type: 'image/jpeg' })
    mockCapture.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })

    const wrapper = mount(CapturePhotoView, { global: { plugins: [router, pinia] } })
    await flushPromises()
    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="camera-accept"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('deficiency-detail')
    expect(router.currentRoute.value.params).toEqual({
      inspectionId: 'insp-d',
      deficiencyId: 'def-d',
    })
    expect(consumeLastAcceptedPhoto({ deficiencyId: 'def-d' })).toBe(jpeg)
  })
})
