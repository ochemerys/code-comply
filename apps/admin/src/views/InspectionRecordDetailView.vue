<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CertificationSnapshotPanel from '../components/CertificationSnapshotPanel.vue'
import AddendumForm from '../components/AddendumForm.vue'
import { useAdminInspectionRecord } from '../composables/useAdminRecords'
import { useAdminAddendumDetail, useAdminCreateAddendum } from '../composables/useAdminAddendum'
import { useInspectionCertificationSnapshot } from '../composables/useInspectionCertificationSnapshot'

const route = useRoute()
const inspectionId = computed(() => String(route.params.id ?? ''))

const { data: record, isPending, error, refetch } = useAdminInspectionRecord(inspectionId)
const createAddendum = useAdminCreateAddendum(inspectionId)

const showAddendumForm = ref(false)
const selectedAddendumId = ref<string | null>(null)
const submitError = ref<string | null>(null)

const snapshotEnabled = computed(() => !!record.value?.hasCertificationSnapshot)
const {
  data: snapshotData,
  isPending: snapshotLoading,
  error: snapshotError,
} = useInspectionCertificationSnapshot(inspectionId, snapshotEnabled)

const { data: addendumDetail, isPending: addendumLoading } = useAdminAddendumDetail(
  inspectionId,
  selectedAddendumId,
)

const loading = computed(() => isPending.value && !record.value)
const canCreateAddendum = computed(() => record.value?.isFinalized === true)

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatGps(gps: { latitude: number; longitude: number; accuracy?: number } | undefined) {
  if (!gps) return '—'
  const acc = gps.accuracy != null ? ` (±${Math.round(gps.accuracy)} m)` : ''
  return `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}${acc}`
}

function openAddendum(id: string) {
  selectedAddendumId.value = id
}

function closeAddendum() {
  selectedAddendumId.value = null
}

async function onAddendumSubmit(payload: { reason: string; content: string; signature: string }) {
  submitError.value = null
  try {
    await createAddendum.mutateAsync(payload)
    showAddendumForm.value = false
    await refetch()
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Failed to create addendum'
  }
}
</script>

<template>
  <div class="space-y-6" data-testid="inspection-record-detail-view">
    <header class="flex flex-wrap items-center gap-3">
      <RouterLink
        to="/compliance/search"
        class="text-sm font-medium text-primary-700 hover:underline"
        data-testid="record-back-to-search"
      >
        ← Compliance search
      </RouterLink>
    </header>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-sm text-text-secondary"
      data-testid="record-detail-loading"
    >
      Loading record…
    </div>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="record-detail-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load record' }}
    </div>

    <template v-else-if="record">
      <section
        class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="record-append-only-notice"
      >
        <p class="font-semibold">Append-only record</p>
        <p class="mt-1">{{ record.appendOnlyMessage }}</p>
        <p
          v-if="record.isFinalized"
          class="mt-2 text-amber-800"
          data-testid="record-no-delete-notice"
        >
          Deletion of inspection records is not permitted. Use an addendum to document corrections.
        </p>
      </section>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-3"
        >
          <h2 class="text-lg font-semibold text-text-primary">Core record</h2>
          <dl class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-text-dim">Inspection ID</dt>
              <dd class="font-mono text-text-primary" data-testid="record-inspection-id">
                {{ record.inspectionId }}
              </dd>
            </div>
            <div v-if="record.uniqueId">
              <dt class="text-text-dim">Legal unique ID</dt>
              <dd class="font-mono text-text-primary">{{ record.uniqueId }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Permit</dt>
              <dd class="font-mono text-text-primary">{{ record.permitNumber }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Status</dt>
              <dd class="text-text-primary">{{ record.status }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Scheduled</dt>
              <dd>{{ formatDate(record.scheduledDate) }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Finalized</dt>
              <dd data-testid="record-finalized-at">{{ formatDate(record.finalizedAt) }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Inspector</dt>
              <dd>{{ record.inspectorName ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Finalized by</dt>
              <dd>{{ record.finalizedByName ?? '—' }}</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-text-dim">Address</dt>
              <dd>{{ record.address }}</dd>
            </div>
            <div v-if="record.legalLandDescription" class="sm:col-span-2">
              <dt class="text-text-dim">Legal land description</dt>
              <dd>{{ record.legalLandDescription }}</dd>
            </div>
            <div v-if="record.documentHash" class="sm:col-span-2">
              <dt class="text-text-dim">Document hash</dt>
              <dd class="break-all font-mono text-xs">{{ record.documentHash }}</dd>
            </div>
            <div v-if="record.notes" class="sm:col-span-2">
              <dt class="text-text-dim">Notes</dt>
              <dd class="whitespace-pre-wrap text-text-primary">{{ record.notes }}</dd>
            </div>
          </dl>
        </section>

        <section
          class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-3"
        >
          <h2 class="text-lg font-semibold text-text-primary">GPS</h2>
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-text-dim">Start GPS</dt>
              <dd data-testid="record-start-gps">{{ formatGps(record.startGps) }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Finalize GPS</dt>
              <dd data-testid="record-finalize-gps">{{ formatGps(record.finalizeGps) }}</dd>
            </div>
          </dl>

          <div v-if="record.hasCertificationSnapshot">
            <h3 class="text-base font-semibold text-text-primary">Certification snapshot</h3>
            <CertificationSnapshotPanel
              :data="snapshotData"
              :loading="snapshotLoading"
              :error="snapshotError instanceof Error ? snapshotError : null"
            />
          </div>
        </section>
      </div>

      <section class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm">
        <h2 class="text-lg font-semibold text-text-primary">
          Deficiencies ({{ record.deficiencyCount }})
        </h2>
        <div class="mt-2 flex flex-wrap gap-3">
          <RouterLink
            :to="{
              name: 'deficiencies',
              query: { inspectionId: record.inspectionId },
            }"
            class="text-sm font-medium text-primary-700 hover:underline"
            data-testid="record-view-all-deficiencies"
          >
            Manage deficiencies
          </RouterLink>
          <RouterLink
            :to="{
              name: 'deficiency-create',
              query: { inspectionId: record.inspectionId },
            }"
            class="text-sm font-medium text-primary-700 hover:underline"
            data-testid="record-create-deficiency"
          >
            Add deficiency
          </RouterLink>
        </div>
        <ul class="mt-3 divide-y divide-border-subtle text-sm">
          <li
            v-for="d in record.deficiencies"
            :key="d.id"
            class="py-2"
            :data-testid="`record-deficiency-${d.id}`"
          >
            <RouterLink
              :to="{ name: 'deficiency-detail', params: { id: d.id } }"
              class="font-medium text-primary-700 hover:underline"
            >
              {{ d.description }}
            </RouterLink>
            <p class="text-text-secondary">
              {{ d.status }}{{ d.severity ? ` · ${d.severity}` : '' }}
            </p>
          </li>
        </ul>
      </section>

      <section class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-text-primary">Addendums</h2>
            <p
              v-if="record.addendums.length > 0"
              class="text-sm text-text-secondary"
              data-testid="record-has-addendum"
            >
              This record has {{ record.addendums.length }} addendum{{
                record.addendums.length === 1 ? '' : 's'
              }}
            </p>
            <p v-else class="text-sm text-text-secondary">No addendums yet.</p>
          </div>
          <button
            v-if="canCreateAddendum && !showAddendumForm"
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            data-testid="record-create-addendum"
            @click="showAddendumForm = true"
          >
            Create addendum
          </button>
        </div>

        <ul v-if="record.addendums.length > 0" class="divide-y divide-border-subtle text-sm">
          <li
            v-for="a in record.addendums"
            :key="a.id"
            class="flex flex-wrap items-center justify-between gap-2 py-3"
            :data-testid="`record-addendum-row-${a.id}`"
          >
            <div>
              <p class="font-medium text-text-primary">{{ a.reason }}</p>
              <p class="text-text-secondary">
                {{ formatDate(a.createdAt) }}
                <span v-if="a.createdByName"> · {{ a.createdByName }}</span>
                <span v-if="a.hasSignature"> · Signed</span>
              </p>
            </div>
            <button
              type="button"
              class="text-sm font-medium text-primary-600 hover:text-primary-800"
              :data-testid="`record-view-addendum-${a.id}`"
              @click="openAddendum(a.id)"
            >
              View
            </button>
          </li>
        </ul>

        <p v-if="!canCreateAddendum" class="text-sm text-text-secondary">
          Addendums can only be created on finalized inspections.
        </p>

        <AddendumForm
          v-if="showAddendumForm"
          :inspection-id="record.inspectionId"
          :submitting="createAddendum.isPending.value"
          @submit="onAddendumSubmit"
          @cancel="showAddendumForm = false"
        />

        <p
          v-if="submitError"
          class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {{ submitError }}
        </p>
      </section>
    </template>

    <div
      v-if="selectedAddendumId"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="addendum-detail-dialog"
      @click.self="closeAddendum"
    >
      <div
        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-xl"
        role="dialog"
      >
        <div class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold text-text-primary">Addendum</h3>
            <p class="text-sm text-text-secondary">
              Addendum to:
              <span class="font-mono">{{ inspectionId }}</span>
            </p>
          </div>
          <button
            type="button"
            class="text-sm font-medium text-text-secondary hover:text-text-primary"
            data-testid="addendum-detail-close"
            @click="closeAddendum"
          >
            Close
          </button>
        </div>

        <div v-if="addendumLoading" class="text-sm text-text-secondary">Loading addendum…</div>
        <template v-else-if="addendumDetail">
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-text-dim">Reason</dt>
              <dd class="text-text-primary">{{ addendumDetail.reason }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Details</dt>
              <dd class="whitespace-pre-wrap text-text-primary">{{ addendumDetail.content }}</dd>
            </div>
            <div>
              <dt class="text-text-dim">Created</dt>
              <dd>{{ formatDate(addendumDetail.createdAt) }}</dd>
            </div>
            <div v-if="addendumDetail.createdByName">
              <dt class="text-text-dim">Author</dt>
              <dd>{{ addendumDetail.createdByName }}</dd>
            </div>
          </dl>
          <img
            v-if="addendumDetail.signature"
            :src="addendumDetail.signature"
            alt="Digital signature"
            class="mt-4 max-h-40 rounded border border-border-subtle"
            data-testid="addendum-signature-image"
          />
        </template>
      </div>
    </div>
  </div>
</template>
