<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DocumentDTO, ReportDTO } from '@codecomply/validators'
import DocumentSignaturePad from './DocumentSignaturePad.vue'
import {
  documentSignedAt,
  reportTypeLabel,
  useDeleteDocumentMutation,
  useDocumentDownloadMutation,
  useEmailDocumentMutation,
  useReportFormatDownloadMutation,
  useSignDocumentMutation,
  useSignReportMutation,
} from '../composables/useAdminDocuments'
import { useDistributeReportMutation } from '../composables/useAdminReports'

const props = defineProps<{
  inspectionId: string
  kind: 'uploaded' | 'generated'
  uploaded?: DocumentDTO[]
  generated?: ReportDTO[]
  loading?: boolean
  readOnly?: boolean
}>()

const inspectionIdRef = computed(() => props.inspectionId)
const downloadMutation = useDocumentDownloadMutation()
const reportDownloadMutation = useReportFormatDownloadMutation()
const deleteMutation = useDeleteDocumentMutation(inspectionIdRef)
const emailMutation = useEmailDocumentMutation()
const signDocMutation = useSignDocumentMutation(inspectionIdRef)
const signReportMutation = useSignReportMutation(inspectionIdRef)
const distributeMutation = useDistributeReportMutation(inspectionIdRef)

const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)
const signingId = ref<string | null>(null)
const emailDocId = ref<string | null>(null)
const emailTo = ref('')
const emailMessage = ref('')

const rowsUploaded = computed(() => props.uploaded ?? [])
const rowsGenerated = computed(() =>
  [...(props.generated ?? [])].sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
  ),
)

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

async function downloadUploaded(id: string) {
  actionError.value = null
  try {
    const url = await downloadMutation.mutateAsync(id)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Download failed'
  }
}

async function downloadReport(id: string, format: 'pdf' | 'docx') {
  actionError.value = null
  try {
    const url = await reportDownloadMutation.mutateAsync({ reportId: id, format })
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Download failed'
  }
}

async function onDelete(id: string) {
  if (!window.confirm('Delete this document?')) return
  actionError.value = null
  try {
    await deleteMutation.mutateAsync(id)
    actionSuccess.value = 'Document deleted'
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Delete failed'
  }
}

async function onEmailSubmit() {
  if (!emailDocId.value) return
  actionError.value = null
  actionSuccess.value = null
  const to = emailTo.value
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean)
  if (to.length === 0) {
    actionError.value = 'Enter at least one recipient email'
    return
  }
  try {
    const result = await emailMutation.mutateAsync({
      documentId: emailDocId.value,
      body: { to, message: emailMessage.value.trim() || undefined },
    })
    if (result.status === 'sent') {
      actionSuccess.value = 'Document sent'
      emailDocId.value = null
    } else {
      actionError.value = result.error ?? 'Email failed'
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Email failed'
  }
}

async function onSignUploaded(id: string, dataUrl: string) {
  actionError.value = null
  try {
    await signDocMutation.mutateAsync({
      documentId: id,
      body: { signatureDataUrl: dataUrl },
    })
    signingId.value = null
    actionSuccess.value = 'Signature applied'
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Signing failed'
  }
}

async function onSignReport(id: string, dataUrl: string) {
  actionError.value = null
  try {
    await signReportMutation.mutateAsync({
      reportId: id,
      body: { signatureDataUrl: dataUrl },
    })
    signingId.value = null
    actionSuccess.value = 'Report signed'
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Signing failed'
  }
}

async function onEmailReport(report: ReportDTO) {
  actionError.value = null
  try {
    const result = await distributeMutation.mutateAsync({
      reportId: report.id,
      recipients: ['owner'],
    })
    if (result.status === 'sent') {
      actionSuccess.value = 'Report emailed to owner'
    } else {
      actionError.value = result.error ?? 'Email failed'
    }
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Email failed'
  }
}
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm"
    data-testid="document-list"
  >
    <h3 class="text-lg font-semibold text-text-primary">
      {{ kind === 'uploaded' ? 'Uploaded documents' : 'Generated documents' }}
    </h3>

    <p
      v-if="actionError"
      class="mt-3 text-sm text-red-700"
      role="alert"
      data-testid="document-list-error"
    >
      {{ actionError }}
    </p>
    <p
      v-if="actionSuccess"
      class="mt-3 text-sm text-emerald-800"
      data-testid="document-list-success"
    >
      {{ actionSuccess }}
    </p>

    <div
      v-if="loading"
      class="mt-4 text-sm text-text-secondary"
      data-testid="document-list-loading"
    >
      Loading…
    </div>

    <div
      v-else-if="kind === 'uploaded' && rowsUploaded.length === 0"
      class="mt-4 rounded-lg border border-dashed border-border-strong bg-bg-app p-6 text-center text-sm text-text-secondary"
      data-testid="document-list-uploaded-empty"
    >
      No uploaded documents yet.
    </div>

    <div
      v-else-if="kind === 'generated' && rowsGenerated.length === 0"
      class="mt-4 rounded-lg border border-dashed border-border-strong bg-bg-app p-6 text-center text-sm text-text-secondary"
      data-testid="document-list-generated-empty"
    >
      No generated reports yet. Use the generator below or wait for sync distribution.
    </div>

    <template v-else>
      <div class="mt-4 hidden overflow-x-auto md:block" data-testid="document-list-desktop">
        <table
          class="min-w-full divide-y divide-border-subtle text-sm"
          data-testid="document-list-table"
        >
          <thead class="bg-bg-app">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-text-secondary">Name</th>
              <th class="px-3 py-2 text-left font-medium text-text-secondary">Details</th>
              <th class="px-3 py-2 text-right font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border-subtle">
            <template v-if="kind === 'uploaded'">
              <tr
                v-for="row in rowsUploaded"
                :key="row.id"
                :data-testid="`document-uploaded-row-${row.id}`"
              >
                <td class="px-3 py-2 font-mono text-xs text-text-primary">{{ row.filename }}</td>
                <td class="px-3 py-2 text-text-secondary">
                  {{ formatWhen(row.createdAt) }}
                  <span v-if="documentSignedAt(row)" class="ml-2 text-emerald-700">· Signed</span>
                </td>
                <td class="px-3 py-2 text-right space-x-2">
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    @click="downloadUploaded(row.id)"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    :disabled="readOnly"
                    @click="emailDocId = row.id"
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    :disabled="readOnly"
                    @click="signingId = row.id"
                  >
                    Sign
                  </button>
                  <button
                    v-if="!readOnly"
                    type="button"
                    class="text-sm font-semibold text-red-700 hover:text-red-900"
                    @click="onDelete(row.id)"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="row in rowsGenerated"
                :key="row.id"
                :data-testid="`document-generated-row-${row.id}`"
              >
                <td class="px-3 py-2 text-text-primary">{{ reportTypeLabel(row.type) }}</td>
                <td class="px-3 py-2 text-text-secondary">
                  {{ row.filename }} · {{ formatWhen(row.generatedAt) }}
                  <span v-if="row.distributedAt" class="ml-1 text-indigo-700">· Emailed</span>
                  <span v-if="row.signedAt" class="ml-1 text-emerald-700">· Signed</span>
                </td>
                <td class="px-3 py-2 text-right space-x-2">
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    @click="downloadReport(row.id, 'pdf')"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    @click="downloadReport(row.id, 'docx')"
                  >
                    Word
                  </button>
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    @click="onEmailReport(row)"
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    class="text-sm font-semibold text-primary-700 hover:text-primary-900"
                    :disabled="!!row.signedAt"
                    @click="signingId = row.id"
                  >
                    Sign
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <ul
        v-if="kind === 'uploaded'"
        class="mt-4 space-y-3 md:hidden"
        data-testid="document-list-mobile"
        role="list"
      >
        <li
          v-for="row in rowsUploaded"
          :key="row.id"
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
          :data-testid="`document-uploaded-card-${row.id}`"
        >
          <p class="break-all font-mono text-xs text-text-primary">{{ row.filename }}</p>
          <p class="mt-1 text-xs text-text-secondary">
            {{ formatWhen(row.createdAt) }}
            <span v-if="documentSignedAt(row)" class="ml-1 text-emerald-700">· Signed</span>
          </p>
          <div class="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              @click="downloadUploaded(row.id)"
            >
              Download
            </button>
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              :disabled="readOnly"
              @click="emailDocId = row.id"
            >
              Email
            </button>
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              :disabled="readOnly"
              @click="signingId = row.id"
            >
              Sign
            </button>
            <button
              v-if="!readOnly"
              type="button"
              class="text-sm font-semibold text-red-700 hover:text-red-900"
              @click="onDelete(row.id)"
            >
              Delete
            </button>
          </div>
        </li>
      </ul>

      <ul v-else class="mt-4 space-y-3 md:hidden" data-testid="document-list-mobile" role="list">
        <li
          v-for="row in rowsGenerated"
          :key="row.id"
          class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
          :data-testid="`document-generated-card-${row.id}`"
        >
          <p class="font-medium text-text-primary">{{ reportTypeLabel(row.type) }}</p>
          <p class="mt-1 text-xs text-text-secondary">
            {{ row.filename }} · {{ formatWhen(row.generatedAt) }}
            <span v-if="row.distributedAt" class="ml-1 text-indigo-700">· Emailed</span>
            <span v-if="row.signedAt" class="ml-1 text-emerald-700">· Signed</span>
          </p>
          <div class="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              @click="downloadReport(row.id, 'pdf')"
            >
              PDF
            </button>
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              @click="downloadReport(row.id, 'docx')"
            >
              Word
            </button>
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              @click="onEmailReport(row)"
            >
              Email
            </button>
            <button
              type="button"
              class="text-sm font-semibold text-primary-700 hover:text-primary-900"
              :disabled="!!row.signedAt"
              @click="signingId = row.id"
            >
              Sign
            </button>
          </div>
        </li>
      </ul>
    </template>

    <div
      v-if="emailDocId"
      class="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4"
      data-testid="document-email-form"
    >
      <h4 class="text-sm font-semibold text-text-primary">Email document</h4>
      <label class="mt-2 block text-sm text-text-secondary">
        Recipients (comma-separated)
        <input
          v-model="emailTo"
          type="text"
          class="mt-1 w-full rounded-md border border-border-strong px-3 py-2 text-sm"
          data-testid="document-email-to"
        />
      </label>
      <label class="mt-2 block text-sm text-text-secondary">
        Message (optional)
        <textarea
          v-model="emailMessage"
          rows="2"
          class="mt-1 w-full rounded-md border border-border-strong px-3 py-2 text-sm"
          data-testid="document-email-message"
        />
      </label>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          data-testid="document-email-send"
          @click="onEmailSubmit"
        >
          Send
        </button>
        <button
          type="button"
          class="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-secondary"
          @click="emailDocId = null"
        >
          Cancel
        </button>
      </div>
    </div>

    <div
      v-if="signingId"
      class="mt-4 rounded-lg border border-border-subtle bg-bg-app p-4"
      data-testid="document-sign-panel"
    >
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold text-text-primary">Sign document</h4>
        <button
          type="button"
          class="text-sm text-text-secondary hover:text-text-primary"
          @click="signingId = null"
        >
          Close
        </button>
      </div>
      <DocumentSignaturePad
        class="mt-3"
        @capture="
          kind === 'uploaded'
            ? onSignUploaded(signingId!, $event)
            : onSignReport(signingId!, $event)
        "
      />
    </div>
  </section>
</template>
