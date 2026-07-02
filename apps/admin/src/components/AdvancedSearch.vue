<script setup lang="ts">
import type { InspectionStatus } from '@codecomply/validators'
import type { ComplianceSearchCriteria } from '../composables/useAdminComplianceSearch'

const criteria = defineModel<ComplianceSearchCriteria>('criteria', { required: true })

defineProps<{
  inspectors: Array<{ id: string; name: string }>
  inspectorsLoading?: boolean
  searching?: boolean
}>()

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'reset'): void
}>()

const statusOptions: { value: InspectionStatus | ''; label: string }[] = [
  { value: '', label: 'Any status' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const outcomeOptions: { value: 'PASSED' | 'FAILED' | ''; label: string }[] = [
  { value: '', label: 'Any outcome' },
  { value: 'PASSED', label: 'Passed' },
  { value: 'FAILED', label: 'Failed' },
]

function onSubmit() {
  emit('search')
}

function onReset() {
  emit('reset')
}
</script>

<template>
  <form
    class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
    data-testid="advanced-search-form"
    @submit.prevent="onSubmit"
  >
    <h3 class="text-lg font-semibold text-text-primary">Search criteria</h3>
    <p class="mt-1 text-sm text-text-secondary">
      FOIP-compliant advanced search for inspection and compliance records.
    </p>

    <div
      class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      data-testid="advanced-search-fields"
    >
      <label class="flex flex-col gap-1 text-sm text-text-secondary xl:col-span-2">
        <span class="font-medium">Legal land description</span>
        <input
          v-model="criteria.legalLandDescription"
          type="search"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Plan, block, lot…"
          data-testid="advanced-search-legal-land"
          autocomplete="off"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Permit number</span>
        <input
          v-model="criteria.permitNumber"
          type="search"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="P-2025-001"
          data-testid="advanced-search-permit"
          autocomplete="off"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Date from</span>
        <input
          v-model="criteria.dateFrom"
          type="date"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="advanced-search-date-from"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Date to</span>
        <input
          v-model="criteria.dateTo"
          type="date"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="advanced-search-date-to"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Inspector</span>
        <select
          v-model="criteria.inspectorId"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="advanced-search-inspector"
          :disabled="inspectorsLoading"
        >
          <option value="">All inspectors</option>
          <option v-for="inspector in inspectors" :key="inspector.id" :value="inspector.id">
            {{ inspector.name }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Status</span>
        <select
          v-model="criteria.status"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="advanced-search-status"
        >
          <option v-for="opt in statusOptions" :key="opt.label" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Outcome</span>
        <select
          v-model="criteria.outcome"
          class="min-h-10 rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          data-testid="advanced-search-outcome"
        >
          <option v-for="opt in outcomeOptions" :key="opt.label" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-4 flex flex-wrap gap-3">
      <button
        type="submit"
        class="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        data-testid="advanced-search-submit"
        :disabled="searching"
      >
        {{ searching ? 'Searching…' : 'Search' }}
      </button>
      <button
        type="button"
        class="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm hover:bg-bg-app"
        data-testid="advanced-search-reset"
        @click="onReset"
      >
        Reset
      </button>
    </div>
  </form>
</template>
