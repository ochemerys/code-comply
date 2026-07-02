<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAdminOrders } from '../composables/useAdminOrders'

const { data, isPending, isFetching, refetch } = useAdminOrders()

const orders = computed(() => data.value ?? [])
const loading = computed(() => isPending.value || (isFetching.value && !data.value))
</script>

<template>
  <div class="space-y-6" data-testid="orders-list-view">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-text-secondary">
        Active Stop Work and unsafe condition escalations (A-05).
      </p>
      <button
        type="button"
        class="rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-bg-app"
        data-testid="orders-refresh"
        :disabled="isFetching"
        @click="refetch()"
      >
        Refresh
      </button>
    </header>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="orders-loading"
    >
      Loading orders…
    </div>

    <div
      v-else-if="!orders.length"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="orders-empty"
    >
      No active Stop Work or unsafe condition orders.
    </div>

    <template v-else>
      <div
        class="hidden rounded-lg border border-border-subtle overflow-hidden bg-bg-surface shadow md:block"
        data-testid="orders-desktop"
      >
        <table class="min-w-full text-sm" data-testid="orders-table">
          <thead class="bg-bg-app border-b border-border-subtle">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Permit</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Type</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Inspector</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Appeal</th>
              <th class="px-4 py-3 text-left font-semibold text-text-secondary">Lock-out</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in orders"
              :key="row.deficiencyId"
              class="border-b border-border-subtle last:border-0 hover:bg-bg-app"
            >
              <td class="px-4 py-3">
                <RouterLink
                  :to="{ name: 'order-detail', params: { deficiencyId: row.deficiencyId } }"
                  class="font-medium text-primary-700 hover:underline"
                >
                  {{ row.permitNumber }}
                </RouterLink>
              </td>
              <td class="px-4 py-3">
                {{ row.orderType === 'STOP_WORK' ? 'Stop Work' : 'Unsafe' }}
              </td>
              <td class="px-4 py-3">{{ row.inspectorName }}</td>
              <td class="px-4 py-3">{{ row.appealDaysRemaining }} day(s)</td>
              <td class="px-4 py-3">
                <span
                  :class="
                    row.lockedOut ? 'text-red-700 font-semibold' : 'text-emerald-700 font-medium'
                  "
                >
                  {{ row.lockedOut ? 'Locked' : 'Override' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="space-y-3 md:hidden" data-testid="orders-mobile" role="list">
        <li
          v-for="row in orders"
          :key="row.deficiencyId"
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
          :data-testid="`orders-card-${row.deficiencyId}`"
        >
          <div class="flex items-start justify-between gap-3">
            <RouterLink
              :to="{ name: 'order-detail', params: { deficiencyId: row.deficiencyId } }"
              class="font-medium text-primary-700 hover:underline"
              :data-testid="`orders-card-detail-${row.deficiencyId}`"
            >
              {{ row.permitNumber }}
            </RouterLink>
            <span
              class="shrink-0 text-xs font-semibold"
              :class="row.lockedOut ? 'text-red-700' : 'text-emerald-700'"
            >
              {{ row.lockedOut ? 'Locked' : 'Override' }}
            </span>
          </div>
          <p class="mt-1 text-sm text-text-secondary">
            {{ row.orderType === 'STOP_WORK' ? 'Stop Work' : 'Unsafe' }}
          </p>
          <dl class="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt class="text-text-dim">Inspector</dt>
              <dd class="text-text-primary">{{ row.inspectorName }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Appeal</dt>
              <dd class="text-text-primary">{{ row.appealDaysRemaining }} day(s)</dd>
            </div>
          </dl>
        </li>
      </ul>
    </template>
  </div>
</template>
