<script setup lang="ts">
import StatsCard from './StatsCard.vue'

defineProps<{
  stats?: {
    activeInspectors: number
    pendingInspections: number
    completedToday: number
    stopWorkOrders: number
  }
  loading?: boolean
}>()

function barWidth(value: number, max: number): string {
  if (max <= 0) return '0%'
  const pct = Math.min(100, Math.round((value / max) * 100))
  return `${pct}%`
}

function maxStat(stats: {
  activeInspectors: number
  pendingInspections: number
  completedToday: number
  stopWorkOrders: number
}): number {
  return Math.max(
    stats.activeInspectors,
    stats.pendingInspections,
    stats.completedToday,
    stats.stopWorkOrders,
    1,
  )
}
</script>

<template>
  <section aria-label="Dashboard charts" data-testid="dashboard-charts">
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <StatsCard label="Active inspectors" :value="stats?.activeInspectors ?? '—'" />
      <StatsCard label="Pending inspections" :value="stats?.pendingInspections ?? '—'" />
      <StatsCard label="Completed today" :value="stats?.completedToday ?? '—'" />
      <StatsCard label="Stop work orders" :value="stats?.stopWorkOrders ?? '—'" variant="danger" />
    </div>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-dim"
      data-testid="dashboard-charts-loading"
    >
      Loading charts…
    </div>

    <div
      v-else-if="stats"
      class="rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-sm"
      data-testid="dashboard-charts-bars"
    >
      <h3 class="text-sm font-semibold text-text-primary mb-4">Workload overview</h3>
      <ul class="space-y-3">
        <li class="flex items-center gap-3">
          <span class="w-36 shrink-0 text-xs text-text-secondary">Active inspectors</span>
          <div class="h-2 flex-1 rounded-full bg-bg-app">
            <div
              class="h-2 rounded-full bg-primary-500 transition-all"
              :style="{ width: barWidth(stats.activeInspectors, maxStat(stats)) }"
            />
          </div>
          <span class="w-8 text-right text-xs font-medium text-text-secondary">{{
            stats.activeInspectors
          }}</span>
        </li>
        <li class="flex items-center gap-3">
          <span class="w-36 shrink-0 text-xs text-text-secondary">Pending inspections</span>
          <div class="h-2 flex-1 rounded-full bg-bg-app">
            <div
              class="h-2 rounded-full bg-amber-500 transition-all"
              :style="{ width: barWidth(stats.pendingInspections, maxStat(stats)) }"
            />
          </div>
          <span class="w-8 text-right text-xs font-medium text-text-secondary">{{
            stats.pendingInspections
          }}</span>
        </li>
        <li class="flex items-center gap-3">
          <span class="w-36 shrink-0 text-xs text-text-secondary">Completed today</span>
          <div class="h-2 flex-1 rounded-full bg-bg-app">
            <div
              class="h-2 rounded-full bg-emerald-500 transition-all"
              :style="{ width: barWidth(stats.completedToday, maxStat(stats)) }"
            />
          </div>
          <span class="w-8 text-right text-xs font-medium text-text-secondary">{{
            stats.completedToday
          }}</span>
        </li>
        <li class="flex items-center gap-3">
          <span class="w-36 shrink-0 text-xs text-text-secondary">Stop work orders</span>
          <div class="h-2 flex-1 rounded-full bg-bg-app">
            <div
              class="h-2 rounded-full bg-red-500 transition-all"
              :style="{ width: barWidth(stats.stopWorkOrders, maxStat(stats)) }"
            />
          </div>
          <span class="w-8 text-right text-xs font-medium text-text-secondary">{{
            stats.stopWorkOrders
          }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
