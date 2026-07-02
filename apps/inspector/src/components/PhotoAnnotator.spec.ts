import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, nextTick } from 'vue'
import PhotoAnnotator from './PhotoAnnotator.vue'

const mockMountCanvas = vi.fn()
const mockDispose = vi.fn()
const mockAddArrow = vi.fn()
const mockAddCircle = vi.fn()
const mockAddText = vi.fn()
const mockUndo = vi.fn()
const mockSave = vi.fn()

vi.mock('@/composables/usePhotoAnnotation', () => ({
  usePhotoAnnotation: () => ({
    canUndo: computed(() => true),
    mountCanvas: mockMountCanvas,
    dispose: mockDispose,
    addArrow: mockAddArrow,
    addCircle: mockAddCircle,
    addText: mockAddText,
    undo: mockUndo,
    save: mockSave,
  }),
}))

describe('PhotoAnnotator (M7-S12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMountCanvas.mockResolvedValue(undefined)
    mockUndo.mockResolvedValue(undefined)
    mockSave.mockResolvedValue({
      dataUrl: 'data:image/png;base64,ZmFrZQ==',
      mimeType: 'image/png' as const,
      width: 100,
      height: 80,
    })
    global.fetch = vi.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
      }),
    ) as unknown as typeof fetch
  })

  it('mounts the canvas and loads the composable', async () => {
    mount(PhotoAnnotator, {
      props: { imageSrc: 'blob:mock' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()
    expect(mockMountCanvas).toHaveBeenCalled()
  })

  it('selects arrow and draws on pointer up', async () => {
    const w = mount(PhotoAnnotator, {
      props: { imageSrc: 'blob:mock' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    await w.find('[data-testid="annotation-tool-arrow"]').trigger('click')

    const canvas = w.find('[data-testid="annotation-canvas"]')
    const el = canvas.element as HTMLCanvasElement
    el.setPointerCapture = vi.fn()
    el.releasePointerCapture = vi.fn()

    await canvas.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    await canvas.trigger('pointerup', { button: 0, clientX: 100, clientY: 50 })

    expect(mockAddArrow).toHaveBeenCalled()
  })

  it('draws a circle when circle tool is active', async () => {
    const w = mount(PhotoAnnotator, {
      props: { imageSrc: 'blob:mock' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    await w.find('[data-testid="annotation-tool-circle"]').trigger('click')

    const canvas = w.find('[data-testid="annotation-canvas"]')
    const el = canvas.element as HTMLCanvasElement
    el.setPointerCapture = vi.fn()
    el.releasePointerCapture = vi.fn()

    await canvas.trigger('pointerdown', { button: 0, clientX: 50, clientY: 50 })
    await canvas.trigger('pointerup', { button: 0, clientX: 100, clientY: 50 })

    expect(mockAddCircle).toHaveBeenCalled()
  })

  it('opens text entry and commits text', async () => {
    const w = mount(PhotoAnnotator, {
      props: { imageSrc: 'blob:mock' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    await w.find('[data-testid="annotation-tool-text"]').trigger('click')

    const canvas = w.find('[data-testid="annotation-canvas"]')
    await canvas.trigger('pointerdown', { button: 0, clientX: 20, clientY: 30 })

    expect(w.find('[data-testid="annotation-text-input"]').exists()).toBe(true)
    await w.find('[data-testid="annotation-text-input"]').setValue('Seal gap')
    await w.find('[data-testid="annotation-text-add"]').trigger('click')

    expect(mockAddText).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      'Seal gap',
    )
  })

  it('emits save with a blob', async () => {
    const w = mount(PhotoAnnotator, {
      props: { imageSrc: 'blob:mock' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    await w.find('[data-testid="annotation-save"]').trigger('click')
    await flushPromises()

    const saves = w.emitted('save')
    expect(saves?.[0]?.[0]).toBeInstanceOf(Blob)
  })

  it('calls undo from toolbar', async () => {
    const w = mount(PhotoAnnotator, {
      props: { imageSrc: 'blob:mock' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    await w.find('[data-testid="annotation-undo"]').trigger('click')
    await flushPromises()
    expect(mockUndo).toHaveBeenCalled()
  })
})
