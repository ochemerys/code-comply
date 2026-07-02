<script setup lang="ts">
import type { VoCDTO } from '@codecomply/validators'

defineProps<{
  voc: VoCDTO
  selected: boolean
}>()

const emit = defineEmits<{
  (e: 'select', voc: VoCDTO): void
}>()

function methodLabel(method: VoCDTO['method']) {
  switch (method) {
    case 'WRITTEN_ASSURANCE':
      return 'Written assurance'
    case 'SITE_VISIT':
      return 'Site visit'
    case 'VERBAL_ASSURANCE':
      return 'Verbal assurance'
    case 'OTHER':
      return 'Other'
    default:
      return method
  }
}

function formatWhen(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
</script>

<template>
  <button
    type="button"
    :class="[
      'w-full text-left rounded-lg border p-4 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
      selected
        ? 'border-primary-500 bg-primary-50 shadow-sm'
        : 'border-border-subtle bg-bg-surface hover:border-border-strong hover:shadow-sm',
    ]"
    :data-testid="`voc-review-card-${voc.id}`"
    @click="emit('select', voc)"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="font-semibold text-text-primary truncate">{{ voc.title }}</p>
        <p class="text-sm text-text-secondary truncate">{{ voc.sectionTitle }}</p>
      </div>
      <span
        class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
        data-testid="voc-review-card-status"
      >
        Pending
      </span>
    </div>
    <dl class="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-text-secondary">
      <dt class="font-medium text-text-dim">Method</dt>
      <dd class="text-text-primary">{{ methodLabel(voc.method) }}</dd>
      <dt class="font-medium text-text-dim">Submitted</dt>
      <dd class="text-text-primary">{{ formatWhen(voc.submittedAt ?? undefined) }}</dd>
    </dl>
  </button>
</template>
