<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ReportDTO, ReportDistributionRecipientDTO } from '@codecomply/validators'
import {
  useDistributeReportMutation,
  useReportDistributionContacts,
} from '../composables/useAdminReports'

const props = defineProps<{
  report: ReportDTO
  inspectionId: string
}>()

const emit = defineEmits<{
  (e: 'distributed', result: { distributedAt: string | null }): void
}>()

const inspectionIdRef = computed(() => props.inspectionId)
const { data: contacts, isPending: contactsLoading } =
  useReportDistributionContacts(inspectionIdRef)
const distributeMutation = useDistributeReportMutation(inspectionIdRef)

const sendOwner = ref(true)
const sendContractor = ref(false)
const sendInspector = ref(false)
const customEmail = ref('')
const formError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const distributedLabel = computed(() => {
  if (!props.report.distributedAt) return 'Not sent'
  return `Sent ${new Date(props.report.distributedAt).toLocaleString()}`
})

async function onSend() {
  formError.value = null
  successMessage.value = null

  const recipients: ReportDistributionRecipientDTO[] = []
  if (sendOwner.value) recipients.push('owner')
  if (sendContractor.value) recipients.push('contractor')
  if (sendInspector.value) recipients.push('inspector')

  const customEmails = customEmail.value
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0)

  if (recipients.length === 0 && customEmails.length === 0) {
    formError.value = 'Select at least one recipient or enter a custom email'
    return
  }

  if (recipients.length === 0) {
    recipients.push('custom')
  }

  try {
    const result = await distributeMutation.mutateAsync({
      reportId: props.report.id,
      recipients,
      customEmails: customEmails.length > 0 ? customEmails : undefined,
    })
    if (result.status === 'sent') {
      successMessage.value = 'Report emailed successfully'
      emit('distributed', { distributedAt: result.distributedAt })
    } else {
      formError.value = result.error ?? 'Distribution failed'
    }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Distribution failed'
  }
}
</script>

<template>
  <div
    class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-3 text-sm"
    data-testid="report-distribution-panel"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h4 class="font-semibold text-indigo-950">Email distribution</h4>
      <span class="text-xs text-indigo-800" data-testid="report-distribution-status">
        {{ distributedLabel }}
      </span>
    </div>

    <p v-if="contactsLoading" class="mt-2 text-xs text-indigo-800">Loading contacts…</p>
    <p v-else-if="contacts" class="mt-2 text-xs text-indigo-800">
      Owner: {{ contacts.ownerEmail }} · Contractor: {{ contacts.contractorEmail }}
      <span v-if="contacts.inspectorEmail"> · Inspector: {{ contacts.inspectorEmail }}</span>
    </p>

    <fieldset class="mt-3 space-y-2">
      <legend class="sr-only">Recipients</legend>
      <label class="flex items-center gap-2 text-indigo-950">
        <input v-model="sendOwner" type="checkbox" data-testid="report-distribute-owner" />
        Applicant / owner
      </label>
      <label class="flex items-center gap-2 text-indigo-950">
        <input
          v-model="sendContractor"
          type="checkbox"
          data-testid="report-distribute-contractor"
        />
        Contractor
      </label>
      <label v-if="contacts?.inspectorEmail" class="flex items-center gap-2 text-indigo-950">
        <input v-model="sendInspector" type="checkbox" data-testid="report-distribute-inspector" />
        Assigned inspector
      </label>
    </fieldset>

    <label class="mt-3 flex flex-col gap-1 text-indigo-950">
      <span class="text-xs font-medium">Custom email</span>
      <input
        v-model="customEmail"
        type="email"
        class="rounded-md border border-indigo-200 bg-bg-surface px-3 py-2 text-sm shadow-sm"
        placeholder="optional@example.com"
        data-testid="report-distribute-custom-email"
      />
    </label>

    <p
      v-if="formError"
      class="mt-2 text-sm text-red-700"
      role="alert"
      data-testid="report-distribution-error"
    >
      {{ formError }}
    </p>
    <p
      v-if="successMessage"
      class="mt-2 text-sm text-emerald-800"
      data-testid="report-distribution-success"
    >
      {{ successMessage }}
    </p>

    <button
      type="button"
      class="mt-3 inline-flex items-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      data-testid="report-distribute-submit"
      :disabled="distributeMutation.isPending.value"
      @click="onSend"
    >
      {{ distributeMutation.isPending.value ? 'Sending…' : 'Send report by email' }}
    </button>
  </div>
</template>
