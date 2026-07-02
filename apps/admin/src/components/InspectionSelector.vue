<script setup lang="ts">
export interface InspectionSelectorRow {
  id: string
  permitId: string
  label: string
}

const props = defineProps<{
  inspections: InspectionSelectorRow[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
}>()

function isSelected(id: string) {
  return props.selectedIds.includes(id)
}

function toggle(id: string, checked: boolean) {
  const next = new Set(props.selectedIds)
  if (checked) next.add(id)
  else next.delete(id)
  emit('update:selectedIds', [...next])
}

function selectAll() {
  emit(
    'update:selectedIds',
    props.inspections.map((r) => r.id),
  )
}

function clearSelection() {
  emit('update:selectedIds', [])
}
</script>

<template>
  <div
    class="rounded-lg border border-border-subtle bg-bg-surface shadow-sm min-w-0"
    data-testid="inspection-selector"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-3 py-2 sm:px-4"
    >
      <div class="text-sm font-semibold text-text-primary">Inspections</div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-lg border border-border-strong text-xs sm:text-sm font-medium text-text-secondary hover:bg-bg-app min-h-[40px] sm:min-h-[36px]"
          data-testid="inspection-selector-select-all"
          @click="selectAll"
        >
          Select all
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded-lg border border-border-strong text-xs sm:text-sm font-medium text-text-secondary hover:bg-bg-app min-h-[40px] sm:min-h-[36px]"
          data-testid="inspection-selector-clear"
          @click="clearSelection"
        >
          Clear
        </button>
      </div>
    </div>

    <ul class="divide-y divide-border-subtle max-h-72 overflow-y-auto">
      <li
        v-for="row in inspections"
        :key="row.id"
        :data-testid="`inspection-selector-row-${row.id}`"
      >
        <label
          class="flex items-center gap-3 px-3 py-2.5 sm:px-4 cursor-pointer hover:bg-bg-app min-h-[44px]"
        >
          <input
            type="checkbox"
            class="h-4 w-4 rounded border-border-strong text-primary-600 focus:ring-primary-500"
            :data-testid="`inspection-selector-check-${row.id}`"
            :checked="isSelected(row.id)"
            @change="toggle(row.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="min-w-0 flex-1">
            <span class="font-semibold text-text-primary">{{ row.permitId }}</span>
            <span v-if="row.label" class="text-text-secondary text-sm ml-2">{{ row.label }}</span>
          </span>
        </label>
      </li>
    </ul>

    <p
      v-if="inspections.length === 0"
      class="text-sm text-text-secondary px-3 py-4 sm:px-4"
      data-testid="inspection-selector-empty"
    >
      No inspections available.
    </p>
  </div>
</template>
