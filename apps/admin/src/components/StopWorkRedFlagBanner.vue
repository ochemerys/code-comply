<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { AdminOrderAlertListItemDTO } from '@codecomply/validators'

const props = defineProps<{
  alerts: AdminOrderAlertListItemDTO[]
  loading: boolean
}>()

const seenIds = ref(new Set<string>())
const showToast = ref(false)
const latestAlert = ref<AdminOrderAlertListItemDTO | null>(null)

watch(
  () => props.alerts,
  (rows) => {
    if (props.loading || rows.length === 0) return
    const fresh = rows.find((row) => !seenIds.value.has(row.deficiencyId))
    if (!fresh) return
    seenIds.value.add(fresh.deficiencyId)
    latestAlert.value = fresh
    showToast.value = true
  },
  { deep: true },
)

const bannerAlerts = computed(() => props.alerts.slice(0, 3))

function dismissToast() {
  showToast.value = false
}
</script>

<template>
  <div class="space-y-3" data-testid="stop-work-red-flag">
    <div
      v-if="showToast && latestAlert"
      class="rounded-lg border-2 border-red-600 bg-red-600 px-4 py-3 text-white shadow-lg"
      role="alert"
      data-testid="stop-work-red-flag-toast"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide">Red-flag alert</p>
          <p class="text-sm font-bold mt-1">
            {{ latestAlert.orderType === 'STOP_WORK' ? 'STOP WORK ORDER' : 'UNSAFE CONDITION' }}
            — {{ latestAlert.permitNumber }}
          </p>
          <p class="text-xs mt-1 opacity-90">
            {{ latestAlert.location ?? 'Site' }} · Inspector: {{ latestAlert.inspectorName }}
          </p>
        </div>
        <button
          type="button"
          class="text-xs font-medium underline hover:no-underline"
          @click="dismissToast"
        >
          Dismiss
        </button>
      </div>
    </div>

    <div
      v-if="bannerAlerts.length"
      class="rounded-lg border border-red-300 bg-red-50 px-4 py-3"
      data-testid="stop-work-red-flag-banner"
    >
      <p class="text-sm font-semibold text-red-900">
        {{ bannerAlerts.length }} active Stop Work / unsafe alert{{
          bannerAlerts.length === 1 ? '' : 's'
        }}
      </p>
      <ul class="mt-2 space-y-1 text-sm text-red-800">
        <li v-for="alert in bannerAlerts" :key="alert.deficiencyId">
          <RouterLink
            :to="{ name: 'order-detail', params: { deficiencyId: alert.deficiencyId } }"
            class="font-medium underline hover:no-underline"
          >
            {{ alert.permitNumber }}
          </RouterLink>
          — appeal deadline in {{ alert.appealDaysRemaining }} day(s)
        </li>
      </ul>
    </div>
  </div>
</template>
