<script setup lang="ts">
import { onMounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'capture', dataUrl: string): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let drawing = false

function getCtx() {
  const canvas = canvasRef.value
  if (!canvas) return null
  return canvas.getContext('2d')
}

function pointerPos(ev: PointerEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: ev.clientX - rect.left,
    y: ev.clientY - rect.top,
  }
}

function onPointerDown(ev: PointerEvent) {
  const ctx = getCtx()
  if (!ctx) return
  drawing = true
  const { x, y } = pointerPos(ev)
  ctx.beginPath()
  ctx.moveTo(x, y)
  canvasRef.value?.setPointerCapture(ev.pointerId)
}

function onPointerMove(ev: PointerEvent) {
  if (!drawing) return
  const ctx = getCtx()
  if (!ctx) return
  const { x, y } = pointerPos(ev)
  ctx.strokeStyle = '#111827'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineTo(x, y)
  ctx.stroke()
}

function onPointerUp() {
  drawing = false
}

function clear() {
  const canvas = canvasRef.value
  const ctx = getCtx()
  if (!canvas || !ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function apply() {
  const canvas = canvasRef.value
  if (!canvas) return
  emit('capture', canvas.toDataURL('image/png'))
}

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = canvas.clientWidth * 2
  canvas.height = canvas.clientHeight * 2
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(2, 2)
  }
})

defineExpose({ clear })
</script>

<template>
  <div data-testid="document-signature-pad" class="space-y-2">
    <p class="text-sm text-text-secondary">Draw your signature below.</p>
    <canvas
      ref="canvasRef"
      class="h-32 w-full touch-none rounded-md border border-border-strong bg-bg-surface"
      data-testid="document-signature-canvas"
      @pointerdown.prevent="onPointerDown"
      @pointermove.prevent="onPointerMove"
      @pointerup.prevent="onPointerUp"
      @pointercancel.prevent="onPointerUp"
    />
    <div class="flex gap-2">
      <button
        type="button"
        class="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-app"
        data-testid="document-signature-clear"
        @click="clear"
      >
        Clear
      </button>
      <button
        type="button"
        class="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
        data-testid="document-signature-apply"
        @click="apply"
      >
        Apply signature
      </button>
    </div>
  </div>
</template>
