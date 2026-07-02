<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { AdminOrderAlertListItemDTO } from '@codecomply/validators'

const props = defineProps<{
  alerts: AdminOrderAlertListItemDTO[]
  loading: boolean
}>()

const stopWorkAlerts = computed(() =>
  props.alerts.filter((a) => a.orderType === 'STOP_WORK' || a.orderType === 'UNSAFE_CONDITION'),
)
</script>

<template>
  <section
    class="rounded-lg border border-red-200 bg-bg-surface shadow-sm"
    data-testid="stop-work-alerts"
  >
    <header class="flex items-center justify-between gap-2 border-b border-red-100 px-4 py-3">
      <h2 class="text-base sm:text-lg font-semibold text-text-primary">
        Stop Work alerts
        <span
          class="ml-2 inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"
        >
          {{ loading ? '…' : stopWorkAlerts.length }}
        </span>
      </h2>
      <RouterLink
        to="/orders"
        class="text-xs sm:text-sm font-medium text-red-700 hover:text-red-900"
      >
        View all
      </RouterLink>
    </header>

    <div v-if="loading" class="px-4 py-6 text-sm text-text-dim">Loading…</div>

    <ul v-else-if="stopWorkAlerts.length" class="divide-y divide-red-100">
      <li
        v-for="row in stopWorkAlerts"
        :key="row.deficiencyId"
        class="px-4 py-3 flex flex-wrap items-center justify-between gap-2"
        :data-testid="`stop-work-row-${row.deficiencyId}`"
      >
        <div class="min-w-0">
          <RouterLink
            :to="{ name: 'order-detail', params: { deficiencyId: row.deficiencyId } }"
            class="font-semibold text-text-primary hover:text-red-800"
          >
            {{ row.permitNumber }}
          </RouterLink>
          <div class="text-xs sm:text-sm text-text-secondary truncate">
            Inspector:
            <span class="font-medium text-text-primary">{{ row.inspectorName }}</span>
          </div>
          <div class="text-xs text-red-700 mt-0.5">
            Appeal: {{ row.appealDaysRemaining }} day(s) remaining
          </div>
        </div>
        <span
          class="inline-flex items-center rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
        >
          {{ row.orderType === 'STOP_WORK' ? 'STOP WORK' : 'UNSAFE' }}
        </span>
      </li>
    </ul>

    <div v-else class="px-4 py-6 text-sm text-text-secondary" data-testid="stop-work-empty">
      No Stop Work alerts right now.
    </div>
  </section>
</template>
