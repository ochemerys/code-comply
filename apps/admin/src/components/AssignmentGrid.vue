<script setup lang="ts">
import { computed, ref } from 'vue'
import { computeDailyAvailability, computeDisciplineMatch } from '@codecomply/validators'
import AssignmentCell, {
  type AssignmentCellInspector,
  type AssignmentCellItem,
} from './AssignmentCell.vue'

export type GridAssignment = AssignmentCellItem & {
  inspectorId: string
  isoDate: string
}

export type GridInspector = AssignmentCellInspector & {
  disciplines?: string[]
}

export type GridUnassignedItem = AssignmentCellItem & {
  discipline?: string | null
}

const props = withDefaults(
  defineProps<{
    inspectors: GridInspector[]
    unassigned: GridUnassignedItem[]
    assignments: GridAssignment[]
    loading?: boolean
    weekStartIso: string
    maxAssignmentsPerDay?: number
  }>(),
  {
    loading: false,
    maxAssignmentsPerDay: 5,
  },
)

const emit = defineEmits<{
  assign: [payload: { inspectionId: string; inspectorId: string; isoDate: string }]
  reassign: [payload: { inspectionId: string; inspectorId: string; isoDate: string }]
  'update:weekStartIso': [iso: string]
}>()

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const dates = computed(() => {
  const start = props.weekStartIso
  return Array.from({ length: 7 }, (_, idx) => {
    const iso = addDaysIso(start, idx)
    const d = new Date(`${iso}T00:00:00.000Z`)
    return {
      iso,
      label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    }
  })
})

const assignmentByCell = computed(() => {
  const map = new Map<string, AssignmentCellItem[]>()
  for (const a of props.assignments) {
    const key = `${a.inspectorId}:${a.isoDate}`
    const list = map.get(key) ?? []
    list.push({
      id: a.id,
      permitId: a.permitId,
      label: a.label,
      description: a.description,
      inspectionId: a.inspectionId,
    })
    map.set(key, list)
  }
  return map
})

const inspectorNameById = computed(() => {
  const map = new Map<string, string>()
  for (const i of props.inspectors) map.set(i.id, i.name)
  return map
})

const assignmentsByDate = computed(() => {
  return dates.value.map((d) => ({
    ...d,
    items: props.assignments
      .filter((a) => a.isoDate === d.iso)
      .map((a) => ({
        id: a.id,
        permitId: a.permitId,
        label: a.label,
        description: a.description,
        inspectorName: inspectorNameById.value.get(a.inspectorId) ?? a.inspectorId,
      })),
  }))
})

const totalByInspector = computed(() => {
  const totals = new Map<string, number>()
  for (const i of props.inspectors) totals.set(i.id, 0)
  for (const a of props.assignments) totals.set(a.inspectorId, (totals.get(a.inspectorId) ?? 0) + 1)
  return totals
})

const selected = ref<{ inspectorId: string; isoDate: string } | null>(null)
const modalAssignment = ref<GridAssignment | null>(null)

const selectedUnassigned = computed(() => {
  if (!selected.value) return []
  return props.unassigned
})

const selectedInspector = computed(() =>
  props.inspectors.find((i) => i.id === selected.value?.inspectorId),
)

const selectedCellCount = computed(() => {
  const sel = selected.value
  if (!sel) return 0
  return props.assignments.filter(
    (a) => a.inspectorId === sel.inspectorId && a.isoDate === sel.isoDate,
  ).length
})

const selectedAvailability = computed(() =>
  computeDailyAvailability(selectedCellCount.value, props.maxAssignmentsPerDay),
)

const projectedAvailability = computed(() =>
  computeDailyAvailability(selectedCellCount.value + 1, props.maxAssignmentsPerDay),
)

function disciplineMatchForItem(item: GridUnassignedItem) {
  const disciplines = selectedInspector.value?.disciplines ?? []
  return computeDisciplineMatch(disciplines, item.discipline ?? null)
}

function cellAvailability(inspectorId: string, isoDate: string) {
  const count = props.assignments.filter(
    (a) => a.inspectorId === inspectorId && a.isoDate === isoDate,
  ).length
  return computeDailyAvailability(count, props.maxAssignmentsPerDay)
}

function intensityForCell(inspectorId: string, isoDate: string) {
  return assignmentByCell.value.get(`${inspectorId}:${isoDate}`)?.length ?? 0
}

function conflictForCell(inspectorId: string, isoDate: string) {
  return intensityForCell(inspectorId, isoDate) > 1
}

function onCellClick(payload: { inspectorId: string; isoDate: string }) {
  selected.value = payload
}

function assignFromUnassigned(assignmentId: string) {
  const sel = selected.value
  if (!sel) return
  const item = props.unassigned.find((a) => a.id === assignmentId)
  if (!item) return
  emit('assign', {
    inspectionId: item.inspectionId ?? item.id,
    inspectorId: sel.inspectorId,
    isoDate: sel.isoDate,
  })
  selected.value = null
}

function onAssignmentDrop(payload: {
  assignmentId: string
  toInspectorId: string
  toIsoDate: string
}) {
  const a = props.assignments.find((x) => x.id === payload.assignmentId)
  if (!a) return
  emit('reassign', {
    inspectionId: a.inspectionId ?? a.id,
    inspectorId: payload.toInspectorId,
    isoDate: payload.toIsoDate,
  })
}

function onAssignmentDblClick(payload: { assignmentId: string }) {
  modalAssignment.value = props.assignments.find((x) => x.id === payload.assignmentId) ?? null
}

function closeModal() {
  modalAssignment.value = null
}

function prevWeek() {
  emit('update:weekStartIso', addDaysIso(props.weekStartIso, -7))
  selected.value = null
}
function nextWeek() {
  emit('update:weekStartIso', addDaysIso(props.weekStartIso, 7))
  selected.value = null
}
function goToday() {
  const today = new Date()
  const day = today.getDay()
  const diff = (day + 6) % 7
  today.setDate(today.getDate() - diff)
  today.setHours(0, 0, 0, 0)
  emit('update:weekStartIso', today.toISOString().slice(0, 10))
  selected.value = null
}
</script>

<template>
  <section
    class="bg-bg-surface rounded-lg shadow p-4 sm:p-6 max-w-full min-w-0"
    data-testid="assignment-grid"
  >
    <div
      v-if="loading"
      class="text-sm text-text-secondary mb-4"
      data-testid="assignment-grid-loading"
    >
      Loading assignments…
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
          data-testid="assignment-grid-prev-week"
          @click="prevWeek"
        >
          Prev
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
          data-testid="assignment-grid-today"
          @click="goToday"
        >
          This week
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
          data-testid="assignment-grid-next-week"
          @click="nextWeek"
        >
          Next
        </button>
      </div>

      <div class="text-sm text-text-secondary">
        Drag assignments between cells, or click an empty cell to assign.
      </div>
    </div>

    <div class="space-y-3 md:hidden" data-testid="assignment-grid-mobile">
      <p class="text-sm text-text-secondary">
        Day-by-day schedule. Open the full grid on a larger screen to drag and rebalance.
      </p>
      <div
        v-for="day in assignmentsByDate"
        :key="day.iso"
        class="rounded-lg border border-border-subtle bg-bg-app p-3"
        :data-testid="`assignment-grid-mobile-day-${day.iso}`"
      >
        <h3 class="text-sm font-semibold text-text-primary">{{ day.label }}</h3>
        <ul v-if="day.items.length" class="mt-2 space-y-2" role="list">
          <li
            v-for="item in day.items"
            :key="item.id"
            class="rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
            :data-testid="`assignment-grid-mobile-item-${item.id}`"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-text-primary">{{ item.permitId }}</span>
              <span v-if="item.label" class="text-xs text-text-secondary">{{ item.label }}</span>
            </div>
            <p v-if="item.description" class="mt-0.5 text-xs text-text-dim">
              {{ item.description }}
            </p>
            <p class="mt-0.5 text-xs text-text-secondary">{{ item.inspectorName }}</p>
          </li>
        </ul>
        <p v-else class="mt-2 text-xs text-text-dim">No inspections scheduled.</p>
      </div>
    </div>

    <div class="hidden overflow-x-auto min-w-0 -mx-1 px-1 sm:mx-0 sm:px-0 md:block">
      <div
        class="grid gap-2 w-full min-w-0"
        :style="{
          gridTemplateColumns: `minmax(8rem, 11rem) repeat(${dates.length}, minmax(0, 1fr))`,
        }"
      >
        <div class="sticky left-0 bg-bg-surface z-10 min-w-0" />
        <div
          v-for="d in dates"
          :key="d.iso"
          class="text-xs font-semibold text-text-secondary px-2 py-1.5 rounded-md bg-bg-app border border-border-subtle min-w-0 truncate"
          :data-testid="`assignment-grid-date-${d.iso}`"
          :title="d.label"
        >
          {{ d.label }}
        </div>

        <template v-for="insp in inspectors" :key="insp.id">
          <div
            class="sticky left-0 bg-bg-surface z-10 pr-2 min-w-0 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)]"
          >
            <div class="rounded-lg border border-border-subtle p-2">
              <div class="font-semibold text-text-primary text-sm truncate">
                {{ insp.name }}
              </div>
              <div class="mt-1 text-xs text-text-secondary">
                Week load:
                <span
                  class="font-medium text-text-primary"
                  :data-testid="`assignment-grid-load-${insp.id}`"
                >
                  {{ totalByInspector.get(insp.id) ?? 0 }}
                </span>
              </div>
            </div>
          </div>

          <AssignmentCell
            v-for="d in dates"
            :key="`${insp.id}-${d.iso}`"
            :inspector="insp"
            :iso-date="d.iso"
            :items="assignmentByCell.get(`${insp.id}:${d.iso}`) ?? []"
            :intensity="intensityForCell(insp.id, d.iso)"
            :conflict="conflictForCell(insp.id, d.iso)"
            :at-capacity="cellAvailability(insp.id, d.iso).atCapacity"
            :over-capacity="cellAvailability(insp.id, d.iso).overCapacity"
            @cell-click="onCellClick"
            @assignment-drop="onAssignmentDrop"
            @assignment-dblclick="onAssignmentDblClick"
          />
        </template>
      </div>
    </div>

    <div
      v-if="selected"
      class="mt-4 rounded-lg border border-border-subtle bg-bg-app p-4"
      data-testid="assignment-grid-assign-panel"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm font-semibold text-text-primary">
          Assign to
          <span>{{ inspectorNameById.get(selected.inspectorId) ?? selected.inspectorId }}</span>
          on
          <span class="font-mono text-xs">{{ selected.isoDate }}</span>
        </div>
        <button
          type="button"
          class="text-sm font-medium text-text-secondary hover:text-text-primary"
          data-testid="assignment-grid-cancel-assign"
          @click="selected = null"
        >
          Cancel
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <div
          v-if="selectedAvailability.guidance.length > 0 || projectedAvailability.overCapacity"
          class="w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="assignment-grid-availability-warning"
        >
          <p class="font-semibold">Daily availability</p>
          <p v-if="selectedAvailability.guidance[0]">{{ selectedAvailability.guidance[0] }}</p>
          <p
            v-if="projectedAvailability.overCapacity"
            class="mt-1 text-xs"
            data-testid="assignment-grid-over-capacity-note"
          >
            Adding another assignment would exceed the default {{ maxAssignmentsPerDay }}/day
            maximum.
          </p>
        </div>

        <button
          v-for="a in selectedUnassigned"
          :key="a.id"
          type="button"
          class="inline-flex flex-col items-start gap-1 rounded-lg bg-bg-surface border px-3 py-2 text-sm text-text-primary hover:bg-bg-app"
          :class="
            disciplineMatchForItem(a).eligible
              ? 'border-border-subtle'
              : 'border-amber-300 bg-amber-50/50'
          "
          :data-testid="`assignment-grid-unassigned-${a.id}`"
          @click="assignFromUnassigned(a.id)"
        >
          <span class="inline-flex items-center gap-2">
            <span class="font-semibold">{{ a.permitId }}</span>
            <span v-if="a.label" class="text-text-secondary">{{ a.label }}</span>
          </span>
          <span
            v-if="a.discipline"
            class="text-xs text-text-secondary"
            :data-testid="`assignment-grid-unassigned-discipline-${a.id}`"
          >
            Discipline: {{ a.discipline }}
          </span>
          <span
            v-if="!disciplineMatchForItem(a).eligible"
            class="text-xs font-medium text-amber-900"
            :data-testid="`assignment-grid-discipline-mismatch-${a.id}`"
          >
            {{ disciplineMatchForItem(a).guidance[0] }}
          </span>
        </button>
        <span v-if="selectedUnassigned.length === 0" class="text-sm text-text-secondary">
          No unassigned inspections to place.
        </span>
      </div>
    </div>

    <div
      v-if="modalAssignment"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      data-testid="assignment-details-modal"
      @click.self="closeModal"
    >
      <div class="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        class="relative w-full max-w-md rounded-xl bg-bg-surface shadow-xl border border-border-subtle p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-text-primary">Assignment details</h3>
            <p class="text-sm text-text-secondary mt-1">
              {{ modalAssignment?.permitId }} — {{ modalAssignment?.label || 'Inspection' }}
            </p>
          </div>
          <button
            type="button"
            class="p-2 rounded-lg hover:bg-bg-app text-text-secondary"
            aria-label="Close"
            data-testid="assignment-details-close"
            @click="closeModal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <dl class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <template v-if="modalAssignment?.description">
            <div class="col-span-1 text-text-secondary">Description</div>
            <div class="col-span-2 text-text-primary font-medium">
              {{ modalAssignment.description }}
            </div>
          </template>

          <div class="col-span-1 text-text-secondary">Inspector</div>
          <div class="col-span-2 text-text-primary font-medium">
            {{
              inspectors.find((i) => i.id === modalAssignment?.inspectorId)?.name ??
              modalAssignment?.inspectorId
            }}
          </div>

          <div class="col-span-1 text-text-secondary">Date</div>
          <div class="col-span-2 text-text-primary font-medium">
            {{ modalAssignment?.isoDate }}
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
