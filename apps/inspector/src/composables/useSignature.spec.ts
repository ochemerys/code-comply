import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, toRaw } from 'vue'
import { mount } from '@vue/test-utils'
import { useSignature } from './useSignature'

function createMockCanvas(overrides: Partial<HTMLCanvasElement> = {}): HTMLCanvasElement {
  const ctx: Partial<CanvasRenderingContext2D> = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn((_path?: Path2D) => {}),
    clearRect: vi.fn(),
    lineWidth: 2,
    strokeStyle: '#000000',
    lineCap: 'round',
    lineJoin: 'round',
  }

  const canvas = {
    getContext: vi.fn().mockReturnValue(ctx),
    getBoundingClientRect: vi.fn().mockReturnValue({ left: 0, top: 0, width: 400, height: 200 }),
    width: 400,
    height: 200,
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,mockdata'),
    toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
      cb(new Blob(['mock'], { type: 'image/png' }))
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as HTMLCanvasElement

  return canvas
}

function firePointerEvent(
  canvas: HTMLCanvasElement,
  type: string,
  opts: Partial<PointerEvent> = {},
) {
  const listeners = (canvas.addEventListener as ReturnType<typeof vi.fn>).mock.calls
  const handler = listeners.find((c: unknown[]) => c[0] === type)?.[1] as
    | ((e: Partial<PointerEvent>) => void)
    | undefined
  handler?.({ clientX: 50, clientY: 50, ...opts } as PointerEvent)
}

describe('useSignature', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts with canvas as null', () => {
      const { canvas } = useSignature()
      expect(canvas.value).toBeNull()
    })

    it('starts with isEmpty as true', () => {
      const { isEmpty } = useSignature()
      expect(isEmpty.value).toBe(true)
    })
  })

  describe('setup', () => {
    it('binds to the canvas element and obtains 2d context', () => {
      const mockCanvas = createMockCanvas()
      const { setup, canvas } = useSignature()

      setup(mockCanvas)

      expect(toRaw(canvas.value)).toBe(mockCanvas)
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
    })

    it('registers pointer event listeners', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()

      setup(mockCanvas)

      const calls = (mockCanvas.addEventListener as ReturnType<typeof vi.fn>).mock.calls
      const eventTypes = calls.map((c: unknown[]) => c[0])
      expect(eventTypes).toContain('pointerdown')
      expect(eventTypes).toContain('pointermove')
      expect(eventTypes).toContain('pointerup')
      expect(eventTypes).toContain('pointerleave')
    })

    it('configures context with default line width and stroke style', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()

      setup(mockCanvas)

      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D
      expect(ctx.lineWidth).toBe(2)
      expect(ctx.strokeStyle).toBe('#000000')
      expect(ctx.lineCap).toBe('round')
      expect(ctx.lineJoin).toBe('round')
    })

    it('applies custom lineWidth and strokeStyle from options', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature({ lineWidth: 5, strokeStyle: '#FF0000' })

      setup(mockCanvas)

      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D
      expect(ctx.lineWidth).toBe(5)
      expect(ctx.strokeStyle).toBe('#FF0000')
    })

    it('removes old listeners when setup is called a second time', () => {
      const mockCanvas1 = createMockCanvas()
      const mockCanvas2 = createMockCanvas()
      const { setup } = useSignature()

      setup(mockCanvas1)
      setup(mockCanvas2)

      expect(
        (mockCanvas1.removeEventListener as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThanOrEqual(4)
    })

    it('handles null context gracefully', () => {
      const mockCanvas = createMockCanvas()
      ;(mockCanvas.getContext as ReturnType<typeof vi.fn>).mockReturnValue(null)
      const { setup } = useSignature()

      expect(() => setup(mockCanvas)).not.toThrow()
    })
  })

  describe('drawing on canvas', () => {
    it('begins path on pointerdown', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 100, clientY: 50 })

      expect(ctx.beginPath).toHaveBeenCalled()
      expect(ctx.moveTo).toHaveBeenCalled()
    })

    it('draws a line on pointermove after pointerdown', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 10, clientY: 10 })
      firePointerEvent(mockCanvas, 'pointermove', { clientX: 50, clientY: 50 })

      expect(ctx.lineTo).toHaveBeenCalled()
      expect(ctx.stroke).toHaveBeenCalled()
    })

    it('does not draw on pointermove without prior pointerdown', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      firePointerEvent(mockCanvas, 'pointermove', { clientX: 50, clientY: 50 })

      expect(ctx.lineTo).not.toHaveBeenCalled()
    })

    it('stops drawing on pointerup', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 10, clientY: 10 })
      firePointerEvent(mockCanvas, 'pointerup')
      firePointerEvent(mockCanvas, 'pointermove', { clientX: 50, clientY: 50 })

      expect(ctx.lineTo).not.toHaveBeenCalled()
    })

    it('stops drawing on pointerleave', () => {
      const mockCanvas = createMockCanvas()
      const { setup } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 10, clientY: 10 })
      firePointerEvent(mockCanvas, 'pointerleave')
      firePointerEvent(mockCanvas, 'pointermove', { clientX: 50, clientY: 50 })

      expect(ctx.lineTo).not.toHaveBeenCalled()
    })

    it('accounts for canvas scaling when computing position', () => {
      const mockCanvas = createMockCanvas()
      ;(mockCanvas.getBoundingClientRect as ReturnType<typeof vi.fn>).mockReturnValue({
        left: 0,
        top: 0,
        width: 200,
        height: 100,
      })
      const { setup } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 100, clientY: 50 })

      expect(ctx.moveTo).toHaveBeenCalledWith(200, 100)
    })
  })

  describe('isEmpty tracking', () => {
    it('is true before any drawing', () => {
      const mockCanvas = createMockCanvas()
      const { setup, isEmpty } = useSignature()
      setup(mockCanvas)

      expect(isEmpty.value).toBe(true)
    })

    it('becomes false after drawing', () => {
      const mockCanvas = createMockCanvas()
      const { setup, isEmpty } = useSignature()
      setup(mockCanvas)

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 10, clientY: 10 })
      firePointerEvent(mockCanvas, 'pointermove', { clientX: 50, clientY: 50 })

      expect(isEmpty.value).toBe(false)
    })

    it('resets to true after clear', () => {
      const mockCanvas = createMockCanvas()
      const { setup, isEmpty, clear } = useSignature()
      setup(mockCanvas)

      firePointerEvent(mockCanvas, 'pointerdown', { clientX: 10, clientY: 10 })
      firePointerEvent(mockCanvas, 'pointermove', { clientX: 50, clientY: 50 })
      clear()

      expect(isEmpty.value).toBe(true)
    })
  })

  describe('clear', () => {
    it('clears the canvas rect', () => {
      const mockCanvas = createMockCanvas()
      const { setup, clear } = useSignature()
      setup(mockCanvas)
      const ctx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

      clear()

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 400, 200)
    })

    it('is a no-op when canvas is not initialized', () => {
      const { clear } = useSignature()
      expect(() => clear()).not.toThrow()
    })
  })

  describe('toDataURL', () => {
    it('exports the canvas as a PNG data URL', () => {
      const mockCanvas = createMockCanvas()
      const { setup, toDataURL } = useSignature()
      setup(mockCanvas)

      const result = toDataURL()

      expect(result).toBe('data:image/png;base64,mockdata')
      expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/png')
    })

    it('returns empty string when canvas is not initialized', () => {
      const { toDataURL } = useSignature()
      expect(toDataURL()).toBe('')
    })
  })

  describe('toBlob', () => {
    it('exports the canvas as a PNG blob', async () => {
      const mockCanvas = createMockCanvas()
      const { setup, toBlob } = useSignature()
      setup(mockCanvas)

      const blob = await toBlob()

      expect(blob).toBeInstanceOf(Blob)
      expect(mockCanvas.toBlob).toHaveBeenCalled()
    })

    it('rejects when canvas is not initialized', async () => {
      const { toBlob } = useSignature()
      await expect(toBlob()).rejects.toThrow('Canvas not initialized')
    })

    it('rejects when toBlob callback provides null', async () => {
      const mockCanvas = createMockCanvas({
        toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
          cb(null)
        }) as unknown as HTMLCanvasElement['toBlob'],
      })
      const { setup, toBlob } = useSignature()
      setup(mockCanvas)

      await expect(toBlob()).rejects.toThrow('Failed to export signature as blob')
    })
  })

  describe('lifecycle cleanup', () => {
    it('removes event listeners on unmount', async () => {
      const mockCanvas = createMockCanvas()

      const TestComp = defineComponent({
        setup() {
          const sig = useSignature()
          sig.setup(mockCanvas)
          return {}
        },
        render: () => h('div'),
      })

      const wrapper = mount(TestComp, { attachTo: document.body })
      wrapper.unmount()
      await nextTick()

      const removeCalls = (mockCanvas.removeEventListener as ReturnType<typeof vi.fn>).mock.calls
      const removedTypes = removeCalls.map((c: unknown[]) => c[0])
      expect(removedTypes).toContain('pointerdown')
      expect(removedTypes).toContain('pointermove')
      expect(removedTypes).toContain('pointerup')
      expect(removedTypes).toContain('pointerleave')
    })
  })

  describe('pointerdown with no context', () => {
    it('ignores pointerdown when context is null', () => {
      const mockCanvas = createMockCanvas()
      ;(mockCanvas.getContext as ReturnType<typeof vi.fn>).mockReturnValue(null)
      const { setup } = useSignature()
      setup(mockCanvas)

      expect(() => firePointerEvent(mockCanvas, 'pointerdown')).not.toThrow()
    })
  })

  describe('SignaturePad component integration', () => {
    it('renders the canvas and buttons', async () => {
      const { default: SignaturePad } = await import('@/components/SignaturePad.vue')

      const wrapper = mount(SignaturePad, { attachTo: document.body })

      expect(wrapper.find('[data-testid="signature-pad"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="signature-canvas"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="signature-clear"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="signature-accept"]').exists()).toBe(true)
    })

    it('has accept button disabled when signature is empty', async () => {
      const { default: SignaturePad } = await import('@/components/SignaturePad.vue')

      const wrapper = mount(SignaturePad, { attachTo: document.body })
      const acceptBtn = wrapper.find('[data-testid="signature-accept"]')

      expect((acceptBtn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })
})
