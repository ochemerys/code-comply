<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSignature } from '../composables/useSignature'

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
  if (props.disabled) return
  clear()
}

function onAccept() {
  if (props.disabled || isEmpty.value) return
  emit('signed', toDataURL())
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="signature-pad">
    <p class="text-sm font-medium text-text-secondary">Digital signature (required)</p>

    <div
      class="overflow-hidden rounded-lg border-2 border-border-strong bg-bg-surface"
      data-testid="signature-canvas-container"
    >
      <canvas
        ref="canvasRef"
        :width="width ?? 400"
        :height="height ?? 160"
        class="block w-full touch-none"
        :class="props.disabled ? 'pointer-events-none opacity-60' : ''"
        data-testid="signature-canvas"
      />
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        class="flex-1 rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-app disabled:opacity-50"
        data-testid="signature-clear"
        :disabled="props.disabled"
        @click="onClear"
      >
        Clear
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="props.disabled || isEmpty"
        data-testid="signature-accept"
        @click="onAccept"
      >
        Accept signature
      </button>
    </div>
  </div>
</template>
