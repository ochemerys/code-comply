<script setup lang="ts">
import { computed } from 'vue'
import type { PermitDTO } from '@codecomply/validators'
import { primaryInspectionStageLabel } from '@codecomply/validators'

/**
 * PermitDetails - Permit information and location (M4-S11).
 * Displays permit number, address, legal land description, scope, status, GPS.
 * Mobile-first: semantic tokens, min 44px touch targets, dark mode.
 */
const props = defineProps<{
  permit: PermitDTO
}>()

const inspectionStageLabel = computed(() => {
  const scheduled = props.permit.inspections
    ?.filter((inspection) => inspection.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0]
  return primaryInspectionStageLabel(scheduled?.stages) ?? props.permit.inspectionStageLabel
})

function formatCoord(value: number | undefined): string {
  if (value == null) return '—'
  return value.toFixed(6)
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const statusBadgeClasses: Record<string, string> = {
  ACTIVE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  COMPLETED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  EXPIRED: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}
</script>

<template>
  <div class="permit-details space-y-6">
    <!-- Permit Information -->
    <section
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
      aria-labelledby="permit-info-heading"
    >
      <h2
        id="permit-info-heading"
        class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4"
      >
        Permit Information
      </h2>
      <dl class="grid gap-3 text-sm">
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Permit number</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
            {{ permit.permitNumber }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Address</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100 mt-0.5 break-words">
            {{ permit.address }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Scope</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
            {{ permit.scope || '—' }}
          </dd>
        </div>
        <div v-if="inspectionStageLabel">
          <dt class="text-gray-500 dark:text-gray-400">Stage</dt>
          <dd
            class="font-medium text-gray-900 dark:text-gray-100 mt-0.5"
            data-testid="permit-detail-stage"
          >
            {{ inspectionStageLabel }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Status</dt>
          <dd class="mt-0.5">
            <span
              :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                statusBadgeClasses[permit.status] ??
                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
              ]"
            >
              {{ permit.status }}
            </span>
          </dd>
        </div>
        <div v-if="permit.legalLandDesc">
          <dt class="text-gray-500 dark:text-gray-400">Legal land description</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100 mt-0.5 break-words">
            {{ permit.legalLandDesc }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Last updated</dt>
          <dd class="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
            {{ formatDate(permit.updatedAt) }}
          </dd>
        </div>
      </dl>
    </section>

    <!-- Location Details -->
    <section
      class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5"
      aria-labelledby="location-heading"
    >
      <h2 id="location-heading" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Location Details
      </h2>
      <dl class="grid gap-3 text-sm">
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Latitude</dt>
          <dd class="font-mono text-gray-900 dark:text-gray-100 mt-0.5">
            {{ formatCoord(permit.latitude) }}
          </dd>
        </div>
        <div>
          <dt class="text-gray-500 dark:text-gray-400">Longitude</dt>
          <dd class="font-mono text-gray-900 dark:text-gray-100 mt-0.5">
            {{ formatCoord(permit.longitude) }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
