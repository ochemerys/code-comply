<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { UserDTO } from '@codecomply/validators'
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/vue-table'

const props = withDefaults(
  defineProps<{
    users: UserDTO[]
    loading?: boolean
    globalFilter?: string
  }>(),
  { loading: false, globalFilter: '' },
)

const emit = defineEmits<{
  view: [userId: string]
}>()

function certSummary(row: UserDTO): string {
  const c = row.certifications
  if (!c?.length) return '—'
  if (c.length <= 2) return c.map((x) => x.discipline).join(', ')
  return `${c.length} certifications`
}

function statusLabel(row: UserDTO): string {
  if (row.isActive === false) return 'Inactive'
  if (row.isActive === true) return 'Active'
  return '—'
}

const columns: ColumnDef<UserDTO>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'email', header: 'Email', enableSorting: true },
  { accessorKey: 'role', header: 'Role', enableSorting: true },
  {
    id: 'status',
    accessorFn: (row) => statusLabel(row),
    header: 'Status',
    enableSorting: true,
  },
  {
    id: 'certifications',
    accessorFn: (row) => certSummary(row),
    header: 'Certifications',
    enableSorting: true,
  },
  { id: 'actions', header: 'Actions', enableSorting: false },
]

const sorting = ref<SortingState>([])
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 8 })
const globalFilter = ref(props.globalFilter ?? '')

watch(
  () => props.globalFilter,
  (v) => {
    globalFilter.value = v ?? ''
    pagination.value = { ...pagination.value, pageIndex: 0 }
  },
)

watch(
  () => props.users,
  () => {
    pagination.value = { ...pagination.value, pageIndex: 0 }
  },
)

const table = useVueTable({
  get data() {
    return props.users
  },
  columns,
  state: {
    get sorting() {
      return sorting.value
    },
    get pagination() {
      return pagination.value
    },
    get globalFilter() {
      return globalFilter.value
    },
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onPaginationChange: (updater) => {
    pagination.value = typeof updater === 'function' ? updater(pagination.value) : updater
  },
  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === 'function' ? updater(globalFilter.value) : updater
  },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: 'includesString',
})

const pageCount = computed(() => table.getPageCount())
</script>

<template>
  <div data-testid="user-table-root">
    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-app px-4 py-6 text-center text-sm text-text-secondary"
      data-testid="user-table-loading"
    >
      Loading users…
    </div>

    <template v-else>
      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex flex-col gap-1 text-sm text-text-secondary sm:max-w-xs">
          <span class="font-medium">Search in table</span>
          <input
            v-model="globalFilter"
            type="search"
            class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Filter loaded rows…"
            data-testid="user-table-global-filter"
            autocomplete="off"
          />
        </label>
        <p class="text-xs text-text-dim">
          {{ users.length }} user{{ users.length === 1 ? '' : 's' }} loaded
        </p>
      </div>

      <div
        class="hidden overflow-x-auto rounded-lg border border-border-subtle shadow-sm md:block"
        data-testid="user-table-desktop"
      >
        <table class="min-w-full divide-y divide-border-subtle text-left text-sm">
          <thead class="bg-bg-app">
            <tr v-for="hg in table.getHeaderGroups()" :key="hg.id">
              <th
                v-for="header in hg.headers"
                :key="header.id"
                scope="col"
                class="px-3 py-3 font-semibold text-text-secondary"
                :class="
                  header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-bg-app' : ''
                "
                @click="header.column.getToggleSortingHandler()?.($event)"
              >
                <span class="inline-flex items-center gap-1">
                  {{ header.isPlaceholder ? '' : String(header.column.columnDef.header) }}
                  <span
                    v-if="header.column.getIsSorted() === 'asc'"
                    class="text-xs"
                    aria-hidden="true"
                    >▲</span
                  >
                  <span
                    v-else-if="header.column.getIsSorted() === 'desc'"
                    class="text-xs"
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle bg-bg-surface">
            <tr v-for="row in table.getRowModel().rows" :key="row.id" class="hover:bg-bg-app">
              <td
                v-for="cell in row.getVisibleCells()"
                :key="cell.id"
                class="whitespace-nowrap px-3 py-2 text-text-primary"
                :data-testid="cell.column.id === 'actions' ? 'user-table-actions-cell' : undefined"
              >
                <template v-if="cell.column.id === 'actions'">
                  <button
                    type="button"
                    class="rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700"
                    :data-testid="`user-table-view-${row.original.id}`"
                    @click="emit('view', row.original.id)"
                  >
                    View
                  </button>
                </template>
                <template v-else-if="cell.column.id === 'status'">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="
                      row.original.isActive === false
                        ? 'bg-red-50 text-red-800 ring-1 ring-red-100'
                        : row.original.isActive === true
                          ? 'bg-green-50 text-green-800 ring-1 ring-green-100'
                          : 'bg-bg-app text-text-secondary ring-1 ring-border-subtle'
                    "
                  >
                    {{ statusLabel(row.original) }}
                  </span>
                </template>
                <template v-else>
                  {{ cell.getValue() as string }}
                </template>
              </td>
            </tr>
            <tr v-if="!table.getRowModel().rows.length">
              <td :colspan="columns.length" class="px-3 py-6 text-center text-text-dim">
                No users match the current filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="space-y-3 md:hidden" data-testid="user-table-mobile" role="list">
        <li
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
          :data-testid="`user-table-card-${row.original.id}`"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold text-text-primary">{{ row.original.name }}</p>
              <p class="truncate text-sm text-text-secondary">{{ row.original.email }}</p>
            </div>
            <span
              class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="
                row.original.isActive === false
                  ? 'bg-red-50 text-red-800 ring-1 ring-red-100'
                  : row.original.isActive === true
                    ? 'bg-green-50 text-green-800 ring-1 ring-green-100'
                    : 'bg-bg-app text-text-secondary ring-1 ring-border-subtle'
              "
            >
              {{ statusLabel(row.original) }}
            </span>
          </div>
          <div class="mt-3 flex items-center justify-between gap-3">
            <span class="text-xs text-text-dim">{{ row.original.role }}</span>
            <button
              type="button"
              class="min-h-11 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
              :data-testid="`user-table-card-view-${row.original.id}`"
              @click="emit('view', row.original.id)"
            >
              View
            </button>
          </div>
        </li>
        <li
          v-if="!table.getRowModel().rows.length"
          class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-6 text-center text-text-dim"
          data-testid="user-table-mobile-empty"
        >
          No users match the current filters.
        </li>
      </ul>

      <div
        class="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="user-table-pagination"
      >
        <p class="text-xs text-text-secondary">
          Page {{ table.getState().pagination.pageIndex + 1 }} of {{ Math.max(pageCount, 1) }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-md border border-border-strong bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary shadow-sm hover:bg-bg-app disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!table.getCanPreviousPage()"
            data-testid="user-table-prev"
            @click="table.previousPage()"
          >
            Previous
          </button>
          <button
            type="button"
            class="rounded-md border border-border-strong bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-secondary shadow-sm hover:bg-bg-app disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!table.getCanNextPage()"
            data-testid="user-table-next"
            @click="table.nextPage()"
          >
            Next
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
