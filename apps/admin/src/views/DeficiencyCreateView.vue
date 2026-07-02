<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { CreateDeficiencyDTO, UpdateDeficiencyDTO } from '@codecomply/validators'
import AdminDeficiencyForm from '../components/AdminDeficiencyForm.vue'
import {
  useAdminInspectionsForDeficiencies,
  useCreateDeficiencyMutation,
} from '../composables/useAdminDeficiencies'

const route = useRoute()
const router = useRouter()

const inspectionId = ref(
  typeof route.query.inspectionId === 'string' ? route.query.inspectionId : '',
)
const submitError = ref<string | null>(null)

const { data: inspections } = useAdminInspectionsForDeficiencies()
const createMutation = useCreateDeficiencyMutation()

const inspectionOptions = computed(() => inspections.value ?? [])

async function onSubmit(payload: CreateDeficiencyDTO | UpdateDeficiencyDTO) {
  if (!('clientId' in payload)) return
  submitError.value = null
  try {
    const created = await createMutation.mutateAsync(payload)
    await router.push({ name: 'deficiency-detail', params: { id: created.id } })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Failed to create deficiency'
  }
}

function onCancel() {
  router.push({ name: 'deficiencies' })
}
</script>

<template>
  <div class="space-y-6" data-testid="deficiency-create-view">
    <header class="space-y-2">
      <RouterLink
        to="/compliance/deficiencies"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="deficiency-create-back"
      >
        ← Deficiencies
      </RouterLink>
    </header>

    <div
      class="max-w-2xl rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-4"
    >
      <div>
        <label
          for="def-create-inspection"
          class="mb-1 block text-sm font-medium text-text-secondary"
        >
          Inspection
        </label>
        <select
          id="def-create-inspection"
          v-model="inspectionId"
          required
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-create-inspection"
        >
          <option value="" disabled>Select inspection</option>
          <option v-for="insp in inspectionOptions" :key="insp.id" :value="insp.id">
            {{ insp.permitNumber }} — {{ insp.address }} ({{ insp.status }})
          </option>
        </select>
      </div>

      <AdminDeficiencyForm
        v-if="inspectionId"
        variant="create"
        :inspection-id="inspectionId"
        :submitting="createMutation.isPending.value"
        @submit="onSubmit"
        @cancel="onCancel"
      />
      <p v-else class="text-sm text-text-secondary">Select an inspection to continue.</p>

      <p
        v-if="submitError"
        class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        role="alert"
      >
        {{ submitError }}
      </p>
    </div>
  </div>
</template>
