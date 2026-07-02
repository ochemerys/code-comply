<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useAdminOrderDetail, useAdminOrderLockOutOverride } from '../composables/useAdminOrders'

const route = useRoute()
const auth = useAuthStore()
const deficiencyId = computed(() => String(route.params.deficiencyId ?? ''))

const { data: order, isPending, error, refetch } = useAdminOrderDetail(deficiencyId)
const overrideMutation = useAdminOrderLockOutOverride()

const overrideReason = ref('')
const overrideError = ref<string | null>(null)

const isSeniorSco = computed(() =>
  (auth.user?.authorities ?? []).some((a) => /senior\s*sco/i.test(a)),
)

const loading = computed(() => isPending.value && !order.value)

async function submitOverride() {
  overrideError.value = null
  if (!overrideReason.value.trim() || overrideReason.value.trim().length < 10) {
    overrideError.value = 'Provide at least 10 characters explaining the override.'
    return
  }
  try {
    await overrideMutation.mutateAsync({
      deficiencyId: deficiencyId.value,
      body: { reason: overrideReason.value.trim() },
    })
    overrideReason.value = ''
    await refetch()
  } catch (e) {
    overrideError.value = e instanceof Error ? e.message : 'Override failed'
  }
}
</script>

<template>
  <div class="space-y-6" data-testid="order-detail-view">
    <header class="flex flex-wrap items-center gap-3">
      <RouterLink to="/orders" class="text-sm font-medium text-primary-700 hover:underline">
        ← Orders
      </RouterLink>
    </header>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="order-detail-loading"
    >
      Loading order…
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      {{ error instanceof Error ? error.message : 'Failed to load order' }}
    </div>

    <template v-else-if="order">
      <section class="rounded-lg border border-red-200 bg-red-50 p-5 space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-red-800">
          {{ order.orderType === 'STOP_WORK' ? 'Stop Work order' : 'Unsafe condition' }}
        </p>
        <h2 class="text-lg font-bold text-text-primary">{{ order.permitNumber }}</h2>
        <p class="text-sm text-text-secondary">{{ order.address ?? order.location ?? '—' }}</p>
        <p class="text-sm text-text-primary">{{ order.description }}</p>
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm space-y-2"
        >
          <h3 class="font-semibold text-text-primary">Service & appeal</h3>
          <dl class="text-sm space-y-1">
            <div class="flex justify-between gap-2">
              <dt class="text-text-secondary">Date of service</dt>
              <dd class="font-medium text-text-primary" data-testid="order-served-at">
                {{ new Date(order.servedAt).toLocaleString() }}
              </dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-text-secondary">Appeal deadline (14 days)</dt>
              <dd class="font-medium text-text-primary" data-testid="order-appeal-deadline">
                {{ new Date(order.appealDeadline).toLocaleDateString() }}
              </dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-text-secondary">Days remaining</dt>
              <dd class="font-semibold text-red-700" data-testid="order-appeal-days-remaining">
                {{ order.appealDaysRemaining }}
              </dd>
            </div>
          </dl>
        </section>

        <section
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm space-y-2"
        >
          <h3 class="font-semibold text-text-primary">Lock-out</h3>
          <p
            class="text-sm font-semibold"
            :class="order.lockedOut ? 'text-red-700' : 'text-emerald-700'"
            data-testid="order-lockout-status"
          >
            {{ order.lockedOut ? 'Locked — override requires Senior SCO' : 'Lock-out cleared' }}
          </p>
          <p v-if="order.lockOutOverriddenAt" class="text-xs text-text-secondary">
            Overridden {{ new Date(order.lockOutOverriddenAt).toLocaleString() }}
            <span v-if="order.lockOutOverriddenByName">
              by {{ order.lockOutOverriddenByName }}</span
            >
          </p>
          <p v-if="order.lockOutOverrideReason" class="text-xs text-text-secondary">
            {{ order.lockOutOverrideReason }}
          </p>

          <form
            v-if="order.lockedOut"
            class="mt-3 space-y-2 border-t border-border-subtle pt-3"
            data-testid="order-override-form"
            @submit.prevent="submitOverride"
          >
            <label class="block text-xs font-medium text-text-secondary" for="override-reason">
              Senior SCO override reason
            </label>
            <textarea
              id="override-reason"
              v-model="overrideReason"
              rows="3"
              class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
              :disabled="!isSeniorSco || overrideMutation.isPending.value"
              placeholder="Document why lock-out is cleared (min. 10 characters)"
            />
            <p
              v-if="!isSeniorSco"
              class="text-xs text-amber-800"
              data-testid="order-override-denied"
            >
              Only a Senior SCO can clear lock-out without the standard approval workflow.
            </p>
            <p v-if="overrideError" class="text-xs text-red-700">{{ overrideError }}</p>
            <button
              type="submit"
              class="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              :disabled="!isSeniorSco || overrideMutation.isPending.value"
              data-testid="order-override-submit"
            >
              Clear lock-out
            </button>
          </form>
        </section>
      </div>

      <section class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm space-y-3">
        <h3 class="font-semibold text-text-primary">Section 49 distribution</h3>
        <ul v-if="order.emailDeliveries.length" class="text-sm space-y-2">
          <li
            v-for="(delivery, idx) in order.emailDeliveries"
            :key="idx"
            class="flex flex-wrap justify-between gap-2 border-b border-border-subtle pb-2 last:border-0"
          >
            <span>{{ delivery.recipient }}</span>
            <span class="font-medium capitalize">{{ delivery.status }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-text-secondary">No email delivery records yet.</p>
        <p v-if="order.smsDeliveredAt" class="text-sm text-text-secondary">
          Senior SCO SMS: sent {{ new Date(order.smsDeliveredAt).toLocaleString() }}
        </p>
      </section>

      <section class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm space-y-2">
        <h3 class="font-semibold text-text-primary">Related records</h3>
        <div class="flex flex-wrap gap-3 text-sm">
          <RouterLink
            :to="{ name: 'inspection-monitor' }"
            class="font-medium text-primary-700 hover:underline"
          >
            Inspection monitor
          </RouterLink>
          <RouterLink
            v-if="order.section49ReportId"
            :to="{ name: 'reports' }"
            class="font-medium text-primary-700 hover:underline"
            data-testid="order-section49-link"
          >
            Section 49 PDF
          </RouterLink>
        </div>
      </section>

      <section
        v-if="order.auditTrail.length"
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
      >
        <h3 class="font-semibold text-text-primary mb-2">Audit trail</h3>
        <ul class="text-xs text-text-secondary space-y-1 max-h-48 overflow-y-auto">
          <li v-for="(entry, idx) in order.auditTrail" :key="idx">
            {{ new Date(entry.at).toLocaleString() }} — {{ entry.action }}
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
