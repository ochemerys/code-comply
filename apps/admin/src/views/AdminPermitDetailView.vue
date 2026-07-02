<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  isSessionExpiredRedirectError,
  useAdminPermitTriageDetail,
} from '../composables/useAdminPermits'

const route = useRoute()
const permitId = computed(() => String(route.params.id ?? ''))

const { data: permit, isPending, error } = useAdminPermitTriageDetail(permitId)

const loading = computed(() => isPending.value && !permit.value)
const showError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}
</script>

<template>
  <div class="space-y-6" data-testid="admin-permit-detail-view">
    <header class="flex flex-wrap items-center gap-3">
      <RouterLink to="/permits" class="text-sm font-medium text-primary-700 hover:underline">
        ← Permits
      </RouterLink>
    </header>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="admin-permit-detail-loading"
    >
      Loading permit…
    </div>

    <div
      v-else-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="admin-permit-detail-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load permit' }}
    </div>

    <template v-else-if="permit">
      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-3"
        data-testid="admin-permit-detail-summary"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Permit</p>
            <h2
              class="text-lg font-bold text-text-primary"
              data-testid="admin-permit-detail-number"
            >
              {{ permit.permitNumber }}
            </h2>
            <p class="text-sm text-text-secondary mt-1">{{ permit.address }}</p>
          </div>
          <span
            class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize"
            :class="
              permit.triage.assignmentEligible
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            "
            data-testid="admin-permit-detail-eligibility"
          >
            {{
              permit.triage.assignmentEligible
                ? 'Eligible for assignment'
                : 'Not eligible for assignment'
            }}
          </span>
        </div>

        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt class="text-text-secondary">Status</dt>
            <dd
              class="font-medium text-text-primary capitalize"
              data-testid="admin-permit-detail-status"
            >
              {{ formatStatus(permit.status) }}
            </dd>
          </div>
          <div>
            <dt class="text-text-secondary">Scope</dt>
            <dd class="font-medium text-text-primary">{{ permit.scope }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-text-secondary">Legal land description</dt>
            <dd
              class="font-medium"
              :class="permit.triage.missingLld ? 'text-amber-800' : 'text-text-primary'"
              data-testid="admin-permit-detail-lld"
            >
              {{ permit.legalLandDesc || 'Missing — confirm with municipality' }}
            </dd>
          </div>
        </dl>
      </section>

      <section
        v-if="permit.triage.missingLld"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2"
        data-testid="admin-permit-detail-missing-lld"
      >
        <p class="text-sm font-semibold text-amber-900">Missing legal land description</p>
        <p class="text-sm text-amber-900">
          Location must be confirmed with the municipality before this permit can be assigned to a
          Safety Codes Officer.
        </p>
      </section>

      <section
        v-if="permit.triage.stopWorkLockedOut"
        class="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2"
        data-testid="admin-permit-detail-stop-work"
      >
        <p class="text-sm font-semibold text-red-900">Stop Work lock-out active</p>
        <p class="text-sm text-red-900">
          A different SCO cannot be assigned without Senior SCO approval while this Stop Work order
          remains locked (A-05).
        </p>
        <RouterLink
          to="/orders"
          class="inline-flex text-sm font-medium text-red-800 hover:underline"
          data-testid="admin-permit-detail-orders-link"
        >
          View Stop Work orders
        </RouterLink>
      </section>

      <section
        v-if="permit.triage.blockReasons.length > 0"
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 space-y-3"
        data-testid="admin-permit-detail-guidance"
      >
        <h3 class="font-semibold text-text-primary">Triage guidance</h3>
        <ul class="list-disc pl-5 text-sm text-text-secondary space-y-1">
          <li v-for="(item, index) in permit.triage.guidance" :key="index">{{ item }}</li>
        </ul>
      </section>

      <div class="flex flex-wrap gap-3">
        <RouterLink
          :to="{ name: 'compliance-search', query: { permitNumber: permit.permitNumber } }"
          class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border-strong text-sm font-medium text-primary-700 hover:bg-bg-app min-h-[44px]"
          data-testid="admin-permit-detail-search-link"
        >
          Search inspection history
        </RouterLink>
      </div>
    </template>
  </div>
</template>
