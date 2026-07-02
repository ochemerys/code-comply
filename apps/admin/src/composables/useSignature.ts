import { ref, computed, getCurrentInstance, onUnmounted, type Ref, type ComputedRef } from 'vue'

export interface UseSignatureOptions {
  lineWidth?: number
  strokeStyle?: string
}

export interface UseSignatureReturn {
  canvas: Ref<HTMLCanvasElement | null>
  isEmpty: ComputedRef<boolean>
  setup: (el: HTMLCanvasElement) => void
  clear: () => void
  toDataURL: () => string
}

const DEFAULT_LINE_WIDTH = 2
const DEFAULT_STROKE_STYLE = '#000000'

/** Canvas-based signature capture for admin addendum workflow (A-06). */
export function useSignature(options?: UseSignatureOptions): UseSignatureReturn {
  const lineWidth = options?.lineWidth ?? DEFAULT_LINE_WIDTH
  const strokeStyle = options?.strokeStyle ?? DEFAULT_STROKE_STYLE

  const canvas = ref<HTMLCanvasElement | null>(null)
  const hasDrawn = ref(false)
  const isEmpty = computed(() => !hasDrawn.value)

  let ctx: CanvasRenderingContext2D | null = null
  let isDrawing = false

  const boundHandlers = {
    pointerdown: null as ((e: PointerEvent) => void) | null,
    pointermove: null as ((e: PointerEvent) => void) | null,
    pointerup: null as (() => void) | null,
    pointerleave: null as (() => void) | null,
  }

  function getPosition(e: PointerEvent): { x: number; y: number } {
    const el = canvas.value!
    const rect = el.getBoundingClientRect()
    const scaleX = el.width / rect.width
    const scaleY = el.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (!ctx) return
    isDrawing = true
    const pos = getPosition(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function onPointerMove(e: PointerEvent) {
    if (!ctx || !isDrawing) return
    const pos = getPosition(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    hasDrawn.value = true
  }

  function onPointerUp() {
    isDrawing = false
  }

  function removeListeners() {
    const el = canvas.value
    if (!el) return
    if (boundHandlers.pointerdown) el.removeEventListener('pointerdown', boundHandlers.pointerdown)
    if (boundHandlers.pointermove) el.removeEventListener('pointermove', boundHandlers.pointermove)
    if (boundHandlers.pointerup) el.removeEventListener('pointerup', boundHandlers.pointerup)
    if (boundHandlers.pointerleave)
      el.removeEventListener('pointerleave', boundHandlers.pointerleave)
  }

  function setup(el: HTMLCanvasElement) {
    removeListeners()
    canvas.value = el
    ctx = el.getContext('2d')
    if (!ctx) return

    ctx.lineWidth = lineWidth
    ctx.strokeStyle = strokeStyle
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    boundHandlers.pointerdown = onPointerDown
    boundHandlers.pointermove = onPointerMove
    boundHandlers.pointerup = onPointerUp
    boundHandlers.pointerleave = onPointerUp

    el.addEventListener('pointerdown', boundHandlers.pointerdown)
    el.addEventListener('pointermove', boundHandlers.pointermove)
    el.addEventListener('pointerup', boundHandlers.pointerup)
    el.addEventListener('pointerleave', boundHandlers.pointerleave)
  }

  function clear() {
    if (!ctx || !canvas.value) return
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
    hasDrawn.value = false
  }

  function toDataURL(): string {
    if (!canvas.value) return ''
    return canvas.value.toDataURL('image/png')
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      removeListeners()
    })
  }

  return {
    canvas,
    isEmpty,
    setup,
    clear,
    toDataURL,
  }
}
