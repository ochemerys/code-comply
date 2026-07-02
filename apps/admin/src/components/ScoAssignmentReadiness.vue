<script setup lang="ts">
import { computed } from 'vue'
import type { UserDTO } from '@codecomply/validators'
import { computeCertificationEligibility } from '@codecomply/validators'

const props = defineProps<{
  user: UserDTO
}>()

const plannedDate = defineModel<string>('plannedDate', { required: true })

const readiness = computed(() =>
  computeCertificationEligibility(
    {
      isActive: props.user.isActive,
      certificationExpiry: props.user.certificationExpiry,
      certifications: props.user.certifications,
    },
    plannedDate.value,
  ),
)
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
    data-testid="user-detail-assignment-readiness"
  >
    <h3 class="mb-3 text-lg font-semibold text-text-primary">Assignment readiness</h3>
    <p class="mb-4 text-sm text-text-secondary">
      Compare certification validity against a planned inspection date before assigning.
    </p>

    <div class="flex flex-wrap items-end gap-4">
      <label class="block text-sm">
        <span class="font-medium text-text-secondary">Planned inspection date (UTC)</span>
        <input
          v-model="plannedDate"
          type="date"
          class="mt-1 block rounded-lg border border-border-strong px-3 py-2 text-sm text-text-primary"
          data-testid="user-detail-planned-date"
        />
      </label>

      <span
        class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
        :class="
          readiness.eligible
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-amber-50 text-amber-900 border border-amber-200'
        "
        data-testid="user-detail-certification-eligibility"
      >
        {{
          readiness.eligible
            ? 'Certification eligible for planned date'
            : 'Certification ineligible for planned date'
        }}
      </span>
    </div>

    <ul
      class="mt-4 space-y-1 text-sm text-text-secondary"
      data-testid="user-detail-readiness-guidance"
    >
      <li v-for="(line, index) in readiness.guidance" :key="index">{{ line }}</li>
    </ul>
  </section>
</template>
