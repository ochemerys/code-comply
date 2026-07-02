import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { FabricImage } from 'fabric'
import {
  usePhotoAnnotation,
  DEFAULT_ANNOTATION_COLOR,
  ANNOTATION_COLOR_OPTIONS,
} from './usePhotoAnnotation'

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

describe('usePhotoAnnotation', () => {
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
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  async function mountFreshCanvas(
    api: ReturnType<typeof usePhotoAnnotation>,
  ): Promise<HTMLCanvasElement> {
    document.body.innerHTML = ''
    const el = document.createElement('canvas')
    el.width = 400
    el.height = 300
    document.body.appendChild(el)
    await api.mountCanvas(el)
    await nextTick()
    return el
  }

  describe('contracts (mocked Fabric)', () => {
    it('mounts Fabric canvas and initializes history (canUndo false)', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      expect(a.canvas.value).toBeTruthy()
      expect(a.canvas.value?.getObjects().length).toBe(0)
      expect(a.canUndo.value).toBe(false)
      await a.dispose()
    })

    it('mountCanvas with photoUrl loads and places background image', async () => {
      const mockImg = {
        width: 200,
        height: 100,
        scale: vi.fn(),
        set: vi.fn(),
      } as unknown as Awaited<ReturnType<typeof FabricImage.fromURL>>
      vi.mocked(FabricImage.fromURL).mockResolvedValueOnce(mockImg)
      const a = usePhotoAnnotation('https://example.com/evidence.jpg')
      document.body.innerHTML = ''
      const el = document.createElement('canvas')
      el.width = 400
      el.height = 300
      document.body.appendChild(el)
      await a.mountCanvas(el)
      expect(FabricImage.fromURL).toHaveBeenCalledWith('https://example.com/evidence.jpg', {
        crossOrigin: 'anonymous',
      })
      expect(a.canvas.value?.backgroundImage).toBeDefined()
      await a.dispose()
    })

    it('addArrow sets activeTool and adds objects', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      a.addArrow({ x: 10, y: 10 }, { x: 100, y: 50 })
      expect(a.activeTool.value).toBe('arrow')
      expect(a.canvas.value?.getObjects().length).toBe(2)
      expect(a.canUndo.value).toBe(true)
      await a.dispose()
    })

    it('addCircle sets activeTool and adds a circle', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      a.addCircle({ x: 120, y: 100 }, 40)
      expect(a.activeTool.value).toBe('circle')
      expect(a.canvas.value?.getObjects().length).toBe(1)
      await a.dispose()
    })

    it('addText sets activeTool and adds IText', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      a.addText({ x: 20, y: 20 }, 'Deficiency A')
      expect(a.activeTool.value).toBe('text')
      expect(a.canvas.value?.getObjects().length).toBe(1)
      await a.dispose()
    })

    it('undo restores prior canvas state', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      a.addCircle({ x: 50, y: 50 }, 25)
      expect(a.canvas.value?.getObjects().length).toBe(1)
      await a.undo()
      expect(a.canvas.value?.getObjects().length).toBe(0)
      expect(a.canUndo.value).toBe(false)
      await a.dispose()
    })

    it('undo no-ops when history is at initial state', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      await a.undo()
      expect(a.canvas.value?.getObjects().length).toBe(0)
      await a.dispose()
    })

    it('undo no-ops after dispose', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      await a.dispose()
      await expect(a.undo()).resolves.toBeUndefined()
    })

    it('save returns a data URL and dimensions', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      a.addText({ x: 10, y: 10 }, 'x')
      const out = await a.save('image/png')
      expect(out.mimeType).toBe('image/png')
      expect(out.width).toBe(400)
      expect(out.height).toBe(300)
      expect(out.dataUrl.startsWith('data:image/png')).toBe(true)
      await a.dispose()
    })

    it('save accepts image/jpeg mime type', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      const out = await a.save('image/jpeg')
      expect(out.mimeType).toBe('image/jpeg')
      await a.dispose()
    })

    it('setAccentColor restricts to configured palette', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      a.setAccentColor('blue')
      expect(a.accentColor.value).toBe('blue')
      a.addCircle({ x: 30, y: 30 }, 10)
      const obj = a.canvas.value?.getObjects()[0] as { opts?: { stroke?: string } }
      expect(obj?.opts?.stroke).toBe('blue')
      expect(() => a.setAccentColor('orange')).toThrow()
      await a.dispose()
    })

    it('defaults accent to red', async () => {
      const a = usePhotoAnnotation()
      expect(a.accentColor.value).toBe(DEFAULT_ANNOTATION_COLOR)
      expect(ANNOTATION_COLOR_OPTIONS).toContain('yellow')
      await a.dispose()
    })

    it('throws when adding shapes before mount', async () => {
      const a = usePhotoAnnotation()
      expect(() => a.addArrow({ x: 0, y: 0 }, { x: 1, y: 1 })).toThrow(/not mounted/)
      expect(() => a.addCircle({ x: 0, y: 0 }, 4)).toThrow(/not mounted/)
      expect(() => a.addText({ x: 0, y: 0 }, 't')).toThrow(/not mounted/)
      await a.dispose()
    })

    it('throws when circle radius is not positive', async () => {
      const a = usePhotoAnnotation()
      await mountFreshCanvas(a)
      expect(() => a.addCircle({ x: 0, y: 0 }, 0)).toThrow(/radius/)
      await a.dispose()
    })
  })

  describe('integration (Vue + composable, mocked Fabric)', () => {
    it('runs mount → annotate → save inside a mounted component', async () => {
      let api: ReturnType<typeof usePhotoAnnotation> | null = null

      const el = document.createElement('canvas')
      el.id = 'anno-canvas'
      el.width = 320
      el.height = 240
      document.body.appendChild(el)

      const View = defineComponent({
        setup() {
          api = usePhotoAnnotation()
          return () => h('div', { class: 'annotation-host' })
        },
      })

      const wrapper = mount(View, { attachTo: document.body })
      await nextTick()

      if (!api) throw new Error('composable not ready')

      await api.mountCanvas(el)
      api.addArrow({ x: 8, y: 8 }, { x: 80, y: 40 })
      api.addText({ x: 12, y: 60 }, 'note')

      const saved = await api.save('image/png')
      expect(saved.dataUrl.startsWith('data:image/png')).toBe(true)
      expect(saved.mimeType).toBe('image/png')

      await api.dispose()
      wrapper.unmount()
    })
  })
})
