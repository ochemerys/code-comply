<script setup lang="ts">
import { computed, ref } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import type { CalendarOptions, DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

export type WorkloadInspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue'

export interface WorkloadInspectorOption {
  id: string
  name: string
}

export interface WorkloadInspectionEvent {
  id: string
  permitId: string
  title: string
  start: string
  inspectorId: string
  status: WorkloadInspectionStatus
}

export type CalendarVisibleRange = {
  start: Date
  end: Date
}

const props = withDefaults(
  defineProps<{
    inspectors: WorkloadInspectorOption[]
    inspections: WorkloadInspectionEvent[]
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{
  datesSet: [range: CalendarVisibleRange]
}>()

const STATUS_COLORS: Record<WorkloadInspectionStatus, string> = {
  scheduled: '#2563eb',
  in_progress: '#ca8a04',
  completed: '#16a34a',
  overdue: '#dc2626',
}

function normalizeStatus(raw: string): WorkloadInspectionStatus {
  const s = raw.toLowerCase().replace(/-/g, '_')
  if (s === 'in_progress') return 'in_progress'
  if (s === 'passed' || s === 'completed') return 'completed'
  if (s === 'failed' || s === 'overdue' || s === 'cancelled') return 'overdue'
  return 'scheduled'
}

const inspectorFilter = ref<string>('')
const selected = ref<WorkloadInspectionEvent | null>(null)

const filteredInspections = computed(() => {
  const fid = inspectorFilter.value
  if (!fid) return props.inspections
  return props.inspections.filter((i) => i.inspectorId === fid)
})

const calendarEvents = computed<EventInput[]>(() =>
  filteredInspections.value.map((i) => {
    const status = normalizeStatus(i.status)
    const inspectorName =
      props.inspectors.find((x) => x.id === i.inspectorId)?.name ?? i.inspectorId
    return {
      id: i.id,
      title: `${i.permitId} · ${i.title}`,
      start: i.start,
      backgroundColor: STATUS_COLORS[status],
      borderColor: STATUS_COLORS[status],
      extendedProps: {
        permitId: i.permitId,
        inspectorId: i.inspectorId,
        inspectorName,
        status,
        label: i.title,
      },
    }
  }),
)

function onDatesSet(arg: DatesSetArg) {
  emit('datesSet', { start: arg.start, end: arg.end })
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek',
  },
  height: 'auto',
  dayMaxEvents: 3,
  events: calendarEvents.value,
  datesSet: onDatesSet,
  eventClick: onEventClick,
}))

function onEventClick(arg: EventClickArg) {
  const ep = arg.event.extendedProps as {
    permitId?: string
    inspectorId?: string
    status?: WorkloadInspectionStatus
    label?: string
  }
  const id = String(arg.event.id)
  const row =
    props.inspections.find((x) => x.id === id) ??
    ({
      id,
      permitId: ep.permitId ?? '',
      title: ep.label ?? String(arg.event.title ?? ''),
      start: arg.event.startStr,
      inspectorId: ep.inspectorId ?? '',
      status: ep.status ?? 'scheduled',
    } satisfies WorkloadInspectionEvent)

  selected.value = row
}

function closeDetails() {
  selected.value = null
}
</script>

<template>
  <section
    class="bg-bg-surface rounded-lg shadow p-4 sm:p-6 max-w-full min-w-0"
    data-testid="workload-calendar"
  >
    <div
      v-if="loading"
      class="text-sm text-text-secondary mb-4"
      data-testid="workload-calendar-loading"
    >
      Loading workload…
    </div>

    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-text-primary">Filter by inspector</div>
        <label class="mt-1 block text-sm text-text-secondary" for="workload-inspector-filter">
          Narrow events to a single inspector or view everyone.
        </label>
        <select
          id="workload-inspector-filter"
          v-model="inspectorFilter"
          class="mt-2 w-full max-w-md rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          data-testid="workload-calendar-inspector-filter"
          aria-describedby="workload-filtered-count"
        >
          <option value="">All inspectors</option>
          <option v-for="insp in inspectors" :key="insp.id" :value="insp.id">
            {{ insp.name }}
          </option>
        </select>
        <p
          id="workload-filtered-count"
          class="sr-only"
          data-testid="workload-calendar-filtered-count"
        >
          {{ filteredInspections.length }} inspections match the current filter.
        </p>
      </div>

      <div class="flex flex-wrap gap-3 text-xs text-text-secondary">
        <div class="flex items-center gap-2">
          <span class="inline-block h-3 w-3 rounded-sm" style="background: #2563eb" />
          Scheduled
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block h-3 w-3 rounded-sm" style="background: #ca8a04" />
          In progress
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block h-3 w-3 rounded-sm" style="background: #16a34a" />
          Completed
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block h-3 w-3 rounded-sm" style="background: #dc2626" />
          Overdue
        </div>
      </div>
    </div>

    <div
      v-if="!loading && filteredInspections.length === 0"
      class="mt-3 rounded-lg border border-dashed border-border-strong bg-bg-app px-4 py-3 text-sm text-text-secondary"
      data-testid="workload-calendar-empty"
    >
      No assigned inspections in this period. Assign work from the assignment grid or try another
      month.
    </div>

    <div class="mt-4 workload-calendar-fc min-w-0">
      <FullCalendar :options="calendarOptions" data-testid="workload-calendar-fc" />
    </div>

    <div
      v-if="selected"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      data-testid="workload-calendar-details-modal"
      @click.self="closeDetails"
    >
      <div class="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        class="relative w-full max-w-md rounded-xl bg-bg-surface shadow-xl border border-border-subtle p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-lg font-semibold text-text-primary">Inspection details</h3>
            <p class="text-sm text-text-secondary mt-1 break-words">
              {{ selected?.permitId }} — {{ selected?.title }}
            </p>
          </div>
          <button
            type="button"
            class="p-2 rounded-lg hover:bg-bg-app text-text-secondary shrink-0"
            aria-label="Close"
            data-testid="workload-calendar-details-close"
            @click="closeDetails"
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
          <div class="col-span-1 text-text-secondary">Inspector</div>
          <div class="col-span-2 text-text-primary font-medium break-words">
            {{
              inspectors.find((i) => i.id === selected?.inspectorId)?.name ?? selected?.inspectorId
            }}
          </div>

          <div class="col-span-1 text-text-secondary">Status</div>
          <div class="col-span-2 text-text-primary font-medium capitalize">
            {{ selected?.status?.replace('_', ' ') }}
          </div>

          <div class="col-span-1 text-text-secondary">Starts</div>
          <div class="col-span-2 text-text-primary font-medium font-mono text-xs">
            {{ selected?.start }}
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workload-calendar-fc :deep(.fc .fc-toolbar.fc-header-toolbar) {
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.workload-calendar-fc :deep(.fc .fc-toolbar-title) {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(17 24 39);
}

.workload-calendar-fc :deep(.fc .fc-button) {
  border-radius: 0.5rem;
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  padding: 0.375rem 0.75rem;
  text-transform: capitalize;
  background-color: #fff;
  border: 1px solid rgb(209 213 219);
  color: rgb(55 65 81);
  box-shadow: none;
}

.workload-calendar-fc :deep(.fc .fc-button:hover:not(:disabled)) {
  background-color: rgb(249 250 251);
  border-color: rgb(209 213 219);
  color: rgb(17 24 39);
}

.workload-calendar-fc :deep(.fc .fc-button:disabled) {
  opacity: 0.45;
}

.workload-calendar-fc :deep(.fc .fc-button-primary:not(:disabled):active),
.workload-calendar-fc :deep(.fc .fc-button-primary:not(:disabled).fc-button-active) {
  background-color: rgb(239 246 255);
  border-color: rgb(147 197 253);
  color: rgb(30 64 175);
}

.workload-calendar-fc :deep(.fc .fc-button:focus) {
  outline: none;
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px rgb(147 197 253);
}

.workload-calendar-fc :deep(.fc .fc-icon) {
  color: inherit;
}

.workload-calendar-fc :deep(.fc .fc-button-group) {
  gap: 0.25rem;
}

.workload-calendar-fc :deep(.fc .fc-button-group .fc-button) {
  margin-left: 0;
}

.workload-calendar-fc :deep(.fc-theme-standard td),
.workload-calendar-fc :deep(.fc-theme-standard th) {
  border-color: rgb(229 231 235);
}
</style>
