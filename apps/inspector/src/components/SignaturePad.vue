<script setup lang="ts">
/**
 * M8-S2: Canvas-based signature pad for capturing digital signatures.
 * Mobile-first, touch-optimized. Uses `useSignature` composable for drawing logic.
 */
import { onMounted, ref } from 'vue'
import { useSignature } from '@/composables/useSignature'

const emit = defineEmits<{
  signed: [dataUrl: string]
}>()

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    disabled?: boolean
  }>(),
  { disabled: false },
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { isEmpty, setup, clear, toDataURL } = useSignature()

onMounted(() => {
  if (canvasRef.value) {
    setup(canvasRef.value)
  }
})

function onClear() {
  // View-only mode (M8-S10)
  if (props.disabled) return
  clear()
}

function onAccept() {
  if (props.disabled) return
  if (isEmpty.value) return
  emit('signed', toDataURL())
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="signature-pad">
    <p class="text-center text-base font-medium text-gray-700">Sign below</p>

    <div
      class="overflow-hidden rounded-xl border-2 border-gray-300 bg-white"
      data-testid="signature-canvas-container"
    >
      <canvas
        ref="canvasRef"
        :width="width ?? 400"
        :height="height ?? 480"
        class="block min-h-[60dvh] w-full touch-none tablet:min-h-[20rem]"
        :class="props.disabled ? 'pointer-events-none opacity-60' : ''"
        data-testid="signature-canvas"
      />
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        class="min-h-touch flex-1 rounded-lg border border-gray-300 bg-white py-3 text-base font-medium text-gray-700 active:scale-95"
        data-testid="signature-clear"
        :disabled="props.disabled"
        :class="props.disabled ? 'cursor-not-allowed opacity-50' : ''"
        @click="onClear"
      >
        Clear
      </button>
      <button
        type="button"
        class="min-h-touch flex-1 rounded-lg bg-blue-600 py-3 text-base font-medium text-white hover:bg-blue-700 active:scale-95 disabled:opacity-50"
        :disabled="props.disabled || isEmpty"
        :class="props.disabled ? 'cursor-not-allowed opacity-50' : ''"
        data-testid="signature-accept"
        @click="onAccept"
      >
        Accept
      </button>
    </div>
  </div>
</template>
