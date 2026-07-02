<script setup lang="ts">
import { computed } from 'vue'

export type AssignmentCellInspector = {
  id: string
  name: string
}

export type AssignmentCellItem = {
  id: string
  inspectionId?: string
  permitId: string
  label?: string
  description?: string
}

const props = defineProps<{
  inspector: AssignmentCellInspector
  isoDate: string
  items: AssignmentCellItem[]
  intensity: number
  conflict: boolean
  atCapacity?: boolean
  overCapacity?: boolean
}>()

const emit = defineEmits<{
  (e: 'cell-click', payload: { inspectorId: string; isoDate: string }): void
  (
    e: 'assignment-drop',
    payload: { assignmentId: string; toInspectorId: string; toIsoDate: string },
  ): void
  (e: 'assignment-dblclick', payload: { assignmentId: string }): void
  (
    e: 'assignment-dragstart',
    payload: { assignmentId: string; fromInspectorId: string; fromIsoDate: string },
  ): void
}>()

const bgClass = computed(() => {
  if (props.conflict) return 'bg-red-50 ring-1 ring-red-200'
  if (props.overCapacity) return 'bg-amber-100 ring-1 ring-amber-300'
  if (props.atCapacity) return 'bg-amber-50 ring-1 ring-amber-200'
  if (props.intensity >= 3) return 'bg-primary-100'
  if (props.intensity === 2) return 'bg-primary-50'
  if (props.intensity === 1) return 'bg-bg-surface'
  return 'bg-bg-surface'
})

function onDrop(e: DragEvent) {
  e.preventDefault()
  const id = e.dataTransfer?.getData('text/assignment-id') || ''
  if (!id) return
  emit('assignment-drop', {
    assignmentId: id,
    toInspectorId: props.inspector.id,
    toIsoDate: props.isoDate,
  })
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDragStart(e: DragEvent, assignmentId: string) {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/assignment-id', assignmentId)
  }
  emit('assignment-dragstart', {
    assignmentId,
    fromInspectorId: props.inspector.id,
    fromIsoDate: props.isoDate,
  })
}
</script>

<template>
  <button
    type="button"
    class="group relative w-full min-w-0 min-h-[4.25rem] rounded-lg border border-border-subtle p-2 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
    :class="[bgClass]"
    :data-testid="`assignment-cell-${inspector.id}-${isoDate}`"
    @click="emit('cell-click', { inspectorId: inspector.id, isoDate })"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <div class="flex flex-col gap-1.5">
      <div v-if="items.length === 0" class="text-xs text-text-dim">Click to assign</div>

      <div v-else class="flex flex-wrap gap-1.5">
        <button
          v-for="it in items"
          :key="it.id"
          type="button"
          draggable="true"
          class="flex flex-col items-start gap-0.5 w-full max-w-full rounded-md bg-text-primary/5 px-2 py-1 text-xs text-text-primary hover:bg-text-primary/10 active:bg-text-primary/15"
          :data-testid="`assignment-chip-${it.id}`"
          :title="it.description || it.label || it.permitId"
          @click.stop
          @dblclick.stop="emit('assignment-dblclick', { assignmentId: it.id })"
          @dragstart="(e) => onDragStart(e, it.id)"
        >
          <span class="font-medium w-full truncate">{{ it.permitId }}</span>
          <span
            v-if="it.description"
            class="w-full truncate text-left text-[11px] text-text-dim"
            :data-testid="`assignment-chip-desc-${it.id}`"
          >
            {{ it.description }}
          </span>
        </button>
      </div>

      <div
        v-if="atCapacity && !conflict"
        class="text-[11px] text-amber-800 mt-1"
        data-testid="assignment-cell-at-capacity"
      >
        At daily maximum
      </div>

      <div
        v-if="conflict"
        class="text-[11px] text-red-700 mt-1"
        data-testid="assignment-cell-conflict"
      >
        Conflict: multiple assignments
      </div>
    </div>
  </button>
</template>
