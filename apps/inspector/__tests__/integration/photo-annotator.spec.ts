/**
 * Integration — PhotoAnnotator + usePhotoAnnotation + AnnotationToolbar (M7-S12), Fabric mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { FabricImage } from 'fabric'
import PhotoAnnotator from '@/components/PhotoAnnotator.vue'

vi.mock('fabric', () => {
  class MockStaticCanvas {
    _objects: unknown[] = []
    width = 0
    height = 0
    backgroundImage?: unknown

    constructor(_el?: unknown, opts?: { width?: number; height?: number }) {
      this.width = opts?.width ?? 0
      this.height = opts?.height ?? 0
    }

    add(...objs: unknown[]): number {
      this._objects.push(...objs)
      return this._objects.length
    }

    getObjects(): unknown[] {
      return this._objects
    }

    renderAll(): void {}

    toJSON(): { objects: unknown[] } {
      return { objects: [...this._objects] }
    }

    async loadFromJSON(json: { objects?: unknown[] }): Promise<void> {
      this._objects = Array.isArray(json.objects) ? [...json.objects] : []
    }

    async dispose(): Promise<void> {}

    toDataURL(): string {
      return 'data:image/png;base64,ZmFrZQ=='
    }
  }

  class Line {
    constructor(
      public pts: number[],
      public opts?: Record<string, unknown>,
    ) {}
  }
  class Circle {
    constructor(public opts?: Record<string, unknown>) {}
  }
  class IText {
    constructor(
      public text: string,
      public opts?: Record<string, unknown>,
    ) {}
  }
  class Triangle {
    constructor(public opts?: Record<string, unknown>) {}
  }

  const FabricImage = {
    fromURL: vi.fn(async () => ({
      width: 100,
      height: 100,
      scale: vi.fn(),
      set: vi.fn(),
    })),
  }

  return {
    StaticCanvas: MockStaticCanvas,
    Line,
    Circle,
    IText,
    Triangle,
    FabricImage,
  }
})

describe('PhotoAnnotator integration (M7-S12)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'DOMMatrix',
      class {
        constructor() {
          /* fabric layout stub */
        }
      },
    )
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      writable: true,
      value: 1,
    })
    global.fetch = vi.fn(() =>
      Promise.resolve({
        blob: () => Promise.resolve(new Blob(['z'], { type: 'image/png' })),
      }),
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('displays full-screen annotator, toolbar, and exports a blob on save', async () => {
    vi.mocked(FabricImage.fromURL).mockResolvedValueOnce({
      width: 80,
      height: 60,
      scale: vi.fn(),
      set: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof FabricImage.fromURL>>)

    const w = mount(PhotoAnnotator, {
      props: { imageSrc: 'https://example.com/photo.jpg' },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    expect(w.find('[data-testid="photo-annotator"]').exists()).toBe(true)
    expect(w.find('[data-testid="annotation-toolbar"]').exists()).toBe(true)

    const canvas = w.find('[data-testid="annotation-canvas"]')
    const el = canvas.element as HTMLCanvasElement
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    await w.find('[data-testid="annotation-tool-arrow"]').trigger('click')
    el.setPointerCapture = vi.fn()
    el.releasePointerCapture = vi.fn()

    await canvas.trigger('pointerdown', { button: 0, clientX: 10, clientY: 10 })
    await canvas.trigger('pointerup', { button: 0, clientX: 90, clientY: 40 })

    await w.find('[data-testid="annotation-save"]').trigger('click')
    await flushPromises()

    expect(w.emitted('save')?.[0]?.[0]).toBeInstanceOf(Blob)
    w.unmount()
  })
})
