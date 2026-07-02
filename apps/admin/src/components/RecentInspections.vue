<script setup lang="ts">
import type { RecentInspectionRow } from '../composables/useAdminDashboard'

defineProps<{
  items: RecentInspectionRow[]
  loading: boolean
}>()
</script>

<template>
  <section class="bg-bg-surface rounded-lg shadow p-6" data-testid="recent-inspections">
    <h3 class="text-lg font-semibold text-text-primary mb-4">Recent inspections</h3>
    <p v-if="loading" class="text-sm text-text-dim">Loading…</p>
    <ul v-else-if="items.length" class="divide-y divide-border-subtle">
      <li
        v-for="row in items"
        :key="row.id"
        class="py-3 flex flex-wrap gap-2 justify-between text-sm"
      >
        <span class="font-medium text-text-primary">
          {{ row.permitId }}
        </span>
        <span class="text-text-secondary">
          {{ row.inspectorName }}
        </span>
        <span class="text-text-dim w-full sm:w-auto">
          {{ row.status }}
        </span>
      </li>
    </ul>
    <p v-else class="text-sm text-text-dim">No recent inspections.</p>
  </section>
</template>
