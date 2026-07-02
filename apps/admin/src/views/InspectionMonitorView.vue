<script setup lang="ts">
import { computed, ref } from 'vue'
import InspectionStatusList from '../components/InspectionStatusList.vue'
import StopWorkAlerts from '../components/StopWorkAlerts.vue'
import { useAdminOrders } from '../composables/useAdminOrders'
import { useInspectionMonitor } from '../composables/useInspectionMonitor'

const filter = ref<
  'ALL' | 'IN_PROGRESS' | 'REVIEW' | 'PENDING_SUBMISSION' | 'SUBMITTED' | 'COMPLETED'
>('ALL')

const { data, isLoading, isFetching, refetch } = useInspectionMonitor()
const { data: orderAlerts, isPending: ordersLoading } = useAdminOrders()

const inspections = computed(() => data.value?.inspections ?? [])
const lastGeneratedAt = computed(() => data.value?.generatedAt ?? null)

const statusOptions = computed(() => {
  const statuses = new Set(inspections.value.map((i) => i.status))
  return ['ALL', ...Array.from(statuses).sort()] as const
})

const filtered = computed(() => {
  if (filter.value === 'ALL') return inspections.value
  return inspections.value.filter((i) => i.status === filter.value)
})
</script>

<template>
  <div class="space-y-6" data-testid="inspection-monitor-view">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <p class="min-w-0 text-sm text-text-secondary">
        Live status, sync health, and alerts for active inspections.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <label
          class="text-sm text-text-secondary flex items-center gap-2"
          data-testid="inspection-monitor-filter"
        >
          <span class="font-medium">Status</span>
          <select
            v-model="filter"
            class="rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm text-text-primary shadow-sm min-h-[40px]"
            data-testid="inspection-monitor-filter-select"
          >
            <option v-for="status in statusOptions" :key="status" :value="status">
              {{ status === 'ALL' ? 'All' : status }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-bg-app min-h-[40px]"
          data-testid="inspection-monitor-refresh"
          @click="refetch()"
        >
          Refresh
        </button>
      </div>
    </header>

    <div
      class="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-text-secondary"
    >
      <div data-testid="inspection-monitor-last-updated">
        <span class="font-medium text-text-secondary">Last updated:</span>
        <span v-if="lastGeneratedAt">{{ new Date(lastGeneratedAt).toLocaleString() }}</span>
        <span v-else>—</span>
      </div>
      <div
        v-if="isFetching && !isLoading"
        class="text-text-dim"
        data-testid="inspection-monitor-fetching"
      >
        Updating…
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <InspectionStatusList :items="filtered" :loading="isLoading" />
      </div>
      <div class="lg:col-span-1">
        <StopWorkAlerts :alerts="orderAlerts ?? []" :loading="isLoading || ordersLoading" />
      </div>
    </div>
  </div>
</template>
