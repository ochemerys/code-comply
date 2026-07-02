<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { UserRole } from '@codecomply/validators'
import UserTable from '../components/UserTable.vue'
import {
  useAdminUsersList,
  isSessionExpiredRedirectError,
  type AdminUsersApiFilters,
} from '../composables/useAdminUsersList'

const router = useRouter()

const searchInput = ref('')
const apiFilters = ref<AdminUsersApiFilters>({
  role: '',
  isActive: 'all',
  search: '',
})

const disciplineFilter = ref('')

let searchDebounce: ReturnType<typeof setTimeout> | undefined
watch(
  () => searchInput.value,
  (v) => {
    clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      apiFilters.value = { ...apiFilters.value, search: v }
    }, 300)
  },
)

const { data, isPending, isFetching, error, refetch } = useAdminUsersList(apiFilters)

const loading = computed(() => isPending.value || (isFetching.value && !data.value))

const showUsersFetchError = computed(
  () => !!error.value && !isSessionExpiredRedirectError(error.value),
)

const disciplineOptions = computed(() => {
  const rows = data.value ?? []
  const set = new Set<string>()
  for (const u of rows) {
    for (const d of u.disciplines ?? []) {
      if (d) set.add(d)
    }
  }
  return [...set].sort()
})

const filteredUsers = computed(() => {
  const rows = data.value ?? []
  const d = disciplineFilter.value.trim()
  if (!d) return rows
  return rows.filter((u) => (u.disciplines ?? []).includes(d))
})

function onView(userId: string) {
  void router.push({ name: 'user-detail', params: { id: userId } })
}

const roleOptions: { value: UserRole | ''; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'SCO', label: 'SCO' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'OWNER', label: 'Owner' },
]
</script>

<template>
  <div data-testid="user-list-view">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <p class="text-text-secondary">Registry, certifications, and account status</p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg border border-primary-600 bg-bg-surface px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm hover:bg-primary-50"
          data-testid="user-list-add-sco"
          @click="() => router.push({ name: 'user-create' })"
        >
          Add SCO
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          data-testid="user-list-refresh"
          :disabled="isFetching"
          @click="() => refetch()"
        >
          Refresh
        </button>
      </div>
    </div>

    <div
      class="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4"
      data-testid="user-list-filters"
    >
      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Role</span>
        <select
          v-model="apiFilters.role"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="user-list-filter-role"
        >
          <option v-for="opt in roleOptions" :key="opt.label" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Status</span>
        <select
          v-model="apiFilters.isActive"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="user-list-filter-status"
        >
          <option value="all">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Discipline</span>
        <select
          v-model="disciplineFilter"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="user-list-filter-discipline"
        >
          <option value="">All disciplines</option>
          <option v-for="d in disciplineOptions" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Search (server)</span>
        <input
          v-model="searchInput"
          type="search"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Email or name…"
          data-testid="user-list-search"
          autocomplete="off"
        />
      </label>
    </div>

    <div
      v-if="showUsersFetchError"
      class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      data-testid="user-list-error"
    >
      {{ (error as Error).message }}
    </div>

    <UserTable :users="filteredUsers" :loading="loading" @view="onView" />
  </div>
</template>
