import {
  computed,
  ref,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
import { Circle, FabricImage, IText, Line, StaticCanvas, Triangle } from 'fabric'

export type Point = { x: number; y: number }

export type AnnotationTool = 'arrow' | 'circle' | 'text'

export const ANNOTATION_COLOR_OPTIONS = ['red', 'yellow', 'blue', 'green'] as const

export type AnnotationColor = (typeof ANNOTATION_COLOR_OPTIONS)[number]

export const DEFAULT_ANNOTATION_COLOR: AnnotationColor = 'red'

/** Raster export from {@link usePhotoAnnotation.save}. */
export interface AnnotatedPhoto {
  dataUrl: string
  mimeType: 'image/png' | 'image/jpeg'
  width: number
  height: number
}

export interface UsePhotoAnnotation {
  /** Fabric static canvas (no selection hit-testing canvases — stable under jsdom test limits). */
  canvas: Ref<StaticCanvas | null>
  activeTool: Ref<AnnotationTool | null>
  canUndo: ComputedRef<boolean>
  accentColor: Ref<string>
  mountCanvas: (
    element: HTMLCanvasElement,
    options?: { width?: number; height?: number },
  ) => Promise<void>
  dispose: () => Promise<void>
  setAccentColor: (color: string) => void
  addArrow: (start: Point, end: Point) => void
  addCircle: (center: Point, radius: number) => void
  addText: (position: Point, text: string) => void
  undo: () => Promise<void>
  save: (mimeType?: 'image/png' | 'image/jpeg') => Promise<AnnotatedPhoto>
}

function assertAnnotationColor(color: string): asserts color is AnnotationColor {
  if (!ANNOTATION_COLOR_OPTIONS.includes(color as AnnotationColor)) {
    throw new Error(`Invalid annotation color: ${color}`)
  }
}

/**
 * Canvas-based inspection photo markup (Fabric.js): arrows, circles, text, undo, raster export.
 * Optional `photoUrl` loads a background image scaled to the canvas (development-plan pattern).
 * Pass a ref/getter so the URL can change after navigation (e.g. object URL from capture).
 */
export function usePhotoAnnotation(
  photoUrl?: MaybeRefOrGetter<string | undefined>,
): UsePhotoAnnotation {
  const canvas = shallowRef<StaticCanvas | null>(null)
  const activeTool = ref<AnnotationTool | null>(null)
  const accentColor = ref<string>(DEFAULT_ANNOTATION_COLOR)

  const history = ref<string[]>([])
  const historyIndex = ref(-1)

  const canUndo = computed(() => historyIndex.value > 0)

  function snapshot(): string {
    const c = canvas.value
    if (!c) return ''
    return JSON.stringify(c.toJSON())
  }

  function pushHistory(): void {
    const c = canvas.value
    if (!c) return
    const snap = snapshot()
    const next = history.value.slice(0, historyIndex.value + 1)
    next.push(snap)
    history.value = next
    historyIndex.value = next.length - 1
  }

  async function dispose(): Promise<void> {
    const c = canvas.value
    canvas.value = null
    history.value = []
    historyIndex.value = -1
    activeTool.value = null
    if (c) await c.dispose()
  }

  async function mountCanvas(
    element: HTMLCanvasElement,
    options?: { width?: number; height?: number },
  ): Promise<void> {
    await dispose()
    const width = options?.width ?? (element.width || 800)
    const height = options?.height ?? (element.height || 600)
    const fc = new StaticCanvas(element, {
      width,
      height,
      enableRetinaScaling: false,
    })
    canvas.value = fc

    const url = photoUrl === undefined ? undefined : toValue(photoUrl)
    if (url) {
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      const iw = img.width || 1
      const ih = img.height || 1
      const scale = Math.min(width / iw, height / ih)
      img.scale(scale)
      img.set({
        left: width / 2,
        top: height / 2,
        originX: 'center',
        originY: 'center',
      })
      fc.backgroundImage = img
    }

    fc.renderAll()
    history.value = [snapshot()]
    historyIndex.value = 0
  }

  function setAccentColor(color: string): void {
    assertAnnotationColor(color)
    accentColor.value = color
  }

  function addArrow(start: Point, end: Point): void {
    const c = canvas.value
    if (!c) throw new Error('Canvas is not mounted')
    activeTool.value = 'arrow'

    const color = accentColor.value
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const inset = 14
    const lineEndX = end.x - ux * inset
    const lineEndY = end.y - uy * inset

    const line = new Line([start.x, start.y, lineEndX, lineEndY], {
      stroke: color,
      strokeWidth: 3,
      selectable: false,
      evented: false,
    })

    const head = new Triangle({
      left: end.x,
      top: end.y,
      width: 14,
      height: 18,
      fill: color,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    })

    c.add(line, head)
    c.renderAll()
    pushHistory()
  }

  function addCircle(center: Point, radius: number): void {
    const c = canvas.value
    if (!c) throw new Error('Canvas is not mounted')
    if (radius <= 0) throw new Error('Circle radius must be positive')
    activeTool.value = 'circle'

    const circle = new Circle({
      left: center.x,
      top: center.y,
      radius,
      originX: 'center',
      originY: 'center',
      fill: 'transparent',
      stroke: accentColor.value,
      strokeWidth: 3,
      selectable: false,
      evented: false,
    })
    c.add(circle)
    c.renderAll()
    pushHistory()
  }

  function addText(position: Point, text: string): void {
    const c = canvas.value
    if (!c) throw new Error('Canvas is not mounted')
    activeTool.value = 'text'

    const label = new IText(text, {
      left: position.x,
      top: position.y,
      fill: accentColor.value,
      fontSize: 20,
      fontFamily: 'system-ui, sans-serif',
      selectable: false,
      evented: false,
    })
    c.add(label)
    c.renderAll()
    pushHistory()
  }

  async function undo(): Promise<void> {
    const c = canvas.value
    if (!c || !canUndo.value) return
    historyIndex.value -= 1
    const json = JSON.parse(history.value[historyIndex.value]) as Record<string, unknown>
    await c.loadFromJSON(json)
    c.renderAll()
  }

  async function save(mimeType: 'image/png' | 'image/jpeg' = 'image/png'): Promise<AnnotatedPhoto> {
    const c = canvas.value
    if (!c) throw new Error('Canvas is not mounted')

    const format = mimeType === 'image/jpeg' ? 'jpeg' : 'png'
    const dataUrl = c.toDataURL({
      format,
      quality: format === 'jpeg' ? 0.92 : 1,
      multiplier: 1,
    })

    return {
      dataUrl,
      mimeType,
      width: c.width,
      height: c.height,
    }
  }

  return {
    canvas,
    activeTool,
    canUndo,
    accentColor,
    mountCanvas,
    dispose,
    setAccentColor,
    addArrow,
    addCircle,
    addText,
    undo,
    save,
  }
}
