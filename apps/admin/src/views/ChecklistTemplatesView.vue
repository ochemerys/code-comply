<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  isSessionExpiredRedirectError,
  useAdminChecklistTemplatesList,
  type AdminChecklistTemplateFilters,
} from '../composables/useAdminChecklistTemplates'

const router = useRouter()

const filters = ref<AdminChecklistTemplateFilters>({
  discipline: '',
  search: '',
  includeInactive: false,
})

const searchInput = ref('')
let debounce: ReturnType<typeof setTimeout> | undefined
watch(searchInput, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    filters.value = { ...filters.value, search: searchInput.value }
  }, 300)
})

const { data, isPending, isFetching, error } = useAdminChecklistTemplatesList(filters)

const loading = computed(() => isPending.value || isFetching.value)
const showError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

function formatVersion(version: number) {
  return `${version}.0`
}

function formatStatus(isActive: boolean) {
  return isActive ? 'Published' : 'Draft'
}

function openCreate() {
  void router.push({ name: 'checklist-template-new' })
}

function openEditor(id: string) {
  void router.push({ name: 'checklist-template-edit', params: { id } })
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="checklist-templates-view">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">
        Build and publish inspection checklist templates with immutable versioning (A-03).
      </p>
      <button
        type="button"
        class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 min-h-[44px]"
        data-testid="checklist-templates-create-button"
        @click="openCreate"
      >
        Create New Template
      </button>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div>
        <label for="tpl-filter-search" class="block text-sm font-medium text-text-secondary mb-1">
          Search
        </label>
        <input
          id="tpl-filter-search"
          v-model="searchInput"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="checklist-templates-filter-search"
        />
      </div>
      <div>
        <label
          for="tpl-filter-discipline"
          class="block text-sm font-medium text-text-secondary mb-1"
        >
          Discipline
        </label>
        <input
          id="tpl-filter-discipline"
          v-model="filters.discipline"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="checklist-templates-filter-discipline"
        />
      </div>
      <div class="flex items-end">
        <label class="inline-flex items-center gap-2 text-sm text-text-secondary min-h-[44px]">
          <input
            v-model="filters.includeInactive"
            type="checkbox"
            class="rounded border-border-strong"
            data-testid="checklist-templates-filter-inactive"
          />
          Include archived
        </label>
      </div>
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="checklist-templates-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load templates' }}
    </div>

    <div
      v-if="loading"
      class="text-sm text-text-secondary"
      data-testid="checklist-templates-loading"
    >
      Loading templates…
    </div>

    <div
      v-else
      class="hidden rounded-lg border border-border-subtle overflow-hidden bg-bg-surface shadow md:block"
      data-testid="checklist-templates-desktop"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm" data-testid="checklist-templates-table">
          <thead class="bg-bg-app border-b border-border-subtle">
            <tr class="text-left text-text-secondary">
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Discipline</th>
              <th class="px-4 py-3 font-medium">Version</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Version hash</th>
              <th class="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data ?? []"
              :key="row.id"
              class="border-b border-border-subtle last:border-0"
              :data-testid="`checklist-template-row-${row.id}`"
            >
              <td class="px-4 py-3 font-medium text-text-primary">{{ row.name }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ row.discipline }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ formatVersion(row.version) }}</td>
              <td class="px-4 py-3 text-text-secondary">
                {{ formatStatus(row.isActive) }}
                <span v-if="row.isLocked" class="text-amber-700 text-xs ml-1">(locked)</span>
              </td>
              <td class="px-4 py-3 text-text-secondary font-mono text-xs truncate max-w-[12rem]">
                {{ row.versionHash }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="text-primary-600 hover:text-primary-800 text-sm font-medium"
                  @click="openEditor(row.id)"
                >
                  Edit
                </button>
              </td>
            </tr>
            <tr v-if="(data ?? []).length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-text-dim">
                No checklist templates match your filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ul
      v-if="!loading"
      class="space-y-3 md:hidden"
      data-testid="checklist-templates-mobile"
      role="list"
    >
      <li
        v-for="row in data ?? []"
        :key="row.id"
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
        :data-testid="`checklist-template-card-${row.id}`"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="font-medium text-text-primary">{{ row.name }}</span>
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-primary-600 hover:text-primary-800"
            :data-testid="`checklist-template-card-edit-${row.id}`"
            @click="openEditor(row.id)"
          >
            Edit
          </button>
        </div>
        <p class="mt-1 text-sm text-text-secondary">{{ row.discipline }}</p>
        <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt class="text-text-dim">Version</dt>
            <dd class="text-text-primary">{{ formatVersion(row.version) }}</dd>
          </div>
          <div>
            <dt class="text-text-dim">Status</dt>
            <dd class="text-text-primary">
              {{ formatStatus(row.isActive) }}
              <span v-if="row.isLocked" class="ml-1 text-amber-700">(locked)</span>
            </dd>
          </div>
        </dl>
      </li>
      <li
        v-if="(data ?? []).length === 0"
        class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-text-dim"
        data-testid="checklist-templates-mobile-empty"
      >
        No checklist templates match your filters.
      </li>
    </ul>
  </div>
</template>
