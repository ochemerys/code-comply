<script setup lang="ts">
/**
 * M7-S12: Full-screen photo preview with Fabric-backed markup (see usePhotoAnnotation).
 */
import { nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import type { AnnotationTool, Point } from '@/composables/usePhotoAnnotation'
import { usePhotoAnnotation } from '@/composables/usePhotoAnnotation'
import AnnotationToolbar from '@/components/AnnotationToolbar.vue'

const props = defineProps<{
  /** Object URL or data URL of the photo to annotate. */
  imageSrc: string
}>()

const emit = defineEmits<{
  save: [blob: Blob]
}>()

const containerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageSrcRef = toRef(props, 'imageSrc')

const { canUndo, mountCanvas, dispose, addArrow, addCircle, addText, undo, save } =
  usePhotoAnnotation(imageSrcRef)

const selectedTool = ref<AnnotationTool | null>(null)
const saving = ref(false)

const showTextEntry = ref(false)
const textDraft = ref('')
const pendingPoint = ref<Point | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)

let dragStart: Point | null = null
let isDragging = false

watch(selectedTool, (t) => {
  if (t !== 'text') {
    showTextEntry.value = false
    textDraft.value = ''
    pendingPoint.value = null
  }
})

async function layoutAndMount(): Promise<void> {
  await nextTick()
  const container = containerRef.value
  const canvas = canvasRef.value
  if (!container || !canvas) return
  const rect = container.getBoundingClientRect()
  const w = Math.max(1, Math.floor(rect.width))
  const h = Math.max(1, Math.floor(rect.height))
  canvas.width = w
  canvas.height = h
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  await mountCanvas(canvas, { width: w, height: h })
}

function canvasPoint(e: PointerEvent): Point {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
  const rw = rect.width || canvas.width || 1
  const rh = rect.height || canvas.height || 1
  const scaleX = canvas.width / rw
  const scaleY = canvas.height / rh
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function onPointerDown(e: PointerEvent): void {
  if (e.button !== 0) return
  const canvas = canvasRef.value
  if (!canvas || !selectedTool.value) return

  const pt = canvasPoint(e)

  if (selectedTool.value === 'text') {
    pendingPoint.value = pt
    showTextEntry.value = true
    textDraft.value = ''
    void nextTick(() => textInputRef.value?.focus())
    return
  }

  isDragging = true
  dragStart = pt
  canvas.setPointerCapture(e.pointerId)
}

function onPointerUp(e: PointerEvent): void {
  const canvas = canvasRef.value
  if (!canvas || !selectedTool.value) return

  if (selectedTool.value === 'text') return

  if (!isDragging || !dragStart) {
    return
  }

  const end = canvasPoint(e)
  try {
    if (selectedTool.value === 'arrow') {
      const d = Math.hypot(end.x - dragStart.x, end.y - dragStart.y)
      if (d > 4) addArrow(dragStart, end)
    } else if (selectedTool.value === 'circle') {
      const r = Math.hypot(end.x - dragStart.x, end.y - dragStart.y)
      if (r > 2) addCircle(dragStart, r)
    }
  } catch {
    /* canvas not ready */
  }

  isDragging = false
  dragStart = null
  try {
    canvas.releasePointerCapture(e.pointerId)
  } catch {
    /* released */
  }
}

function onPointerCancel(e: PointerEvent): void {
  isDragging = false
  dragStart = null
  try {
    canvasRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onSelectTool(tool: AnnotationTool): void {
  selectedTool.value = tool
}

async function onUndo(): Promise<void> {
  await undo()
}

function commitText(): void {
  const p = pendingPoint.value
  if (!p) return
  const t = textDraft.value.trim()
  if (t) {
    try {
      addText(p, t)
    } catch {
      /* not mounted */
    }
  }
  showTextEntry.value = false
  textDraft.value = ''
  pendingPoint.value = null
}

function cancelText(): void {
  showTextEntry.value = false
  textDraft.value = ''
  pendingPoint.value = null
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function onSave(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    const out = await save('image/png')
    emit('save', dataUrlToBlob(out.dataUrl))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void nextTick(() => {
    void layoutAndMount()
  })
})

watch(
  () => props.imageSrc,
  () => {
    void nextTick(() => {
      void layoutAndMount()
    })
  },
)

onUnmounted(() => {
  void dispose()
})
</script>

<template>
  <div class="flex h-dvh max-h-dvh flex-col overflow-hidden bg-black" data-testid="photo-annotator">
    <div
      ref="containerRef"
      class="relative min-h-0 flex-1 touch-none"
      data-testid="photo-annotator-stage"
    >
      <canvas
        ref="canvasRef"
        class="block max-h-full max-w-full touch-none"
        data-testid="annotation-canvas"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      />

      <div
        v-if="showTextEntry"
        class="absolute inset-x-0 bottom-0 border-t border-white/10 bg-slate-900/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        data-testid="annotation-text-entry"
      >
        <label class="mb-1 block text-sm text-white/80" for="annotation-text-input"
          >Annotation text</label
        >
        <div class="flex gap-2">
          <input
            id="annotation-text-input"
            ref="textInputRef"
            v-model="textDraft"
            type="text"
            class="min-h-touch flex-1 rounded-lg border border-white/20 bg-white/10 px-3 text-base text-white placeholder:text-white/40"
            placeholder="e.g. Failed seal"
            data-testid="annotation-text-input"
            @keydown.enter.prevent="commitText"
          />
          <button
            type="button"
            class="min-h-touch shrink-0 rounded-lg bg-blue-600 px-4 text-base font-medium text-white"
            data-testid="annotation-text-add"
            @click="commitText"
          >
            Add
          </button>
          <button
            type="button"
            class="min-h-touch shrink-0 rounded-lg border border-white/20 px-4 text-base text-white"
            data-testid="annotation-text-cancel"
            @click="cancelText"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <AnnotationToolbar
      :active-tool="selectedTool"
      :can-undo="canUndo"
      :saving="saving"
      @select-tool="onSelectTool"
      @undo="onUndo"
      @save="onSave"
    />
  </div>
</template>
