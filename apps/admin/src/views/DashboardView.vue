<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAdminDashboard } from '../composables/useAdminDashboard'
import { defineLazyComponent } from '../lib/lazy-component'
import RecentInspections from '../components/RecentInspections.vue'
import PendingAssignments from '../components/PendingAssignments.vue'
import StopWorkRedFlagBanner from '../components/StopWorkRedFlagBanner.vue'

const DashboardCharts = defineLazyComponent(() => import('../components/DashboardCharts.vue'))

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { data, isPending, isFetching, refetch, failureCount } = useAdminDashboard()

const stats = computed(() => data.value?.stats)
const loading = computed(() => isPending.value || (isFetching.value && !data.value))
const showStaleWarning = computed(() => failureCount.value > 0 && !!data.value)
const showPermissionDeniedNotice = computed(() => route.query.reason === 'permission_denied')

function dismissPermissionDeniedNotice() {
  void router.replace({ name: 'dashboard', query: {} })
}
</script>

<template>
  <div>
    <div
      v-if="showPermissionDeniedNotice"
      class="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      data-testid="dashboard-permission-denied-notice"
      role="alert"
    >
      You do not have permission to access that page.
      <button
        type="button"
        class="ml-2 font-medium underline hover:no-underline"
        @click="dismissPermissionDeniedNotice"
      >
        Dismiss
      </button>
    </div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">Welcome back, {{ authStore.user?.name }}</p>
      <div class="flex flex-wrap gap-2 items-center">
        <span
          v-if="showStaleWarning"
          class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1"
        >
          Showing last loaded data — refresh failed
        </span>
        <span
          v-if="isFetching && data"
          class="text-xs text-text-dim"
          data-testid="dashboard-refreshing"
        >
          Refreshing…
        </span>
        <button
          type="button"
          class="text-sm font-medium px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          data-testid="dashboard-refresh"
          :disabled="isFetching"
          @click="() => refetch()"
        >
          Refresh now
        </button>
      </div>
    </div>

    <StopWorkRedFlagBanner :alerts="data?.stopWorkAlerts ?? []" :loading="loading && !data" />

    <DashboardCharts :stats="stats" :loading="loading && !data" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <RecentInspections :items="data?.recentInspections ?? []" :loading="loading && !data" />
      <PendingAssignments :items="data?.pendingAssignments ?? []" :loading="loading && !data" />
    </div>

    <section class="bg-bg-surface rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-text-primary mb-4">Quick actions</h3>
      <div class="flex flex-wrap gap-3">
        <RouterLink
          to="/users"
          class="inline-flex items-center px-4 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
        >
          Manage users
        </RouterLink>
        <RouterLink
          to="/permits"
          class="inline-flex items-center px-4 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
        >
          View permits
        </RouterLink>
        <RouterLink
          to="/inspections"
          class="inline-flex items-center px-4 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
        >
          Inspections
        </RouterLink>
        <RouterLink
          to="/reports"
          class="inline-flex items-center px-4 py-2 rounded-lg border border-border-strong text-sm font-medium text-text-secondary hover:bg-bg-app"
        >
          Reports
        </RouterLink>
      </div>
    </section>
  </div>
</template>
