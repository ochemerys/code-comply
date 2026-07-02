<script setup lang="ts">
import { computed, ref } from 'vue'
import PassAllConfirmDialog from './PassAllConfirmDialog.vue'

interface Props {
  count: number
  disabled?: boolean
  title?: string
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  title: 'Pass All Items?',
  message: 'This will mark {count} items as PASS',
})

const emit = defineEmits<{
  (e: 'confirm'): void
}>()

const open = ref(false)
const isDisabled = computed(() => props.disabled || props.count <= 0)

function onClick() {
  if (isDisabled.value) return
  open.value = true
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <div class="inline-flex">
    <button
      type="button"
      class="min-h-touch min-w-[44px] px-4 rounded-xl bg-primary text-white text-base font-medium hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary active:scale-95 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="checklist-pass-all"
      :disabled="isDisabled"
      @click="onClick"
    >
      Pass all
    </button>

    <PassAllConfirmDialog
      v-model="open"
      :count="count"
      :title="title"
      :message="message"
      @confirm="onConfirm"
    />
  </div>
</template>
