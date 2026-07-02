<script setup lang="ts">
import type { ReportDTO } from '@codecomply/validators'

defineProps<{
  report: ReportDTO
}>()
</script>

<template>
  <div
    class="mt-4 rounded-lg border border-border-subtle bg-bg-app px-4 py-3 text-sm"
    data-testid="report-metadata-panel"
  >
    <h4 class="font-semibold text-text-primary">Report metadata</h4>
    <dl class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div>
        <dt class="text-xs font-medium uppercase tracking-wide text-text-dim">Unique report ID</dt>
        <dd
          class="mt-0.5 font-mono text-xs text-text-primary"
          data-testid="report-metadata-unique-id"
        >
          {{ report.uniqueReportId ?? report.id }}
        </dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-xs font-medium uppercase tracking-wide text-text-dim">SHA-256 hash</dt>
        <dd
          class="mt-0.5 break-all font-mono text-xs text-text-primary"
          data-testid="report-metadata-hash"
        >
          {{ report.hash }}
        </dd>
      </div>
      <div v-if="report.verifyUrl" class="sm:col-span-2">
        <dt class="text-xs font-medium uppercase tracking-wide text-text-dim">Verification</dt>
        <dd class="mt-0.5">
          <a
            :href="report.verifyUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-semibold text-primary-700 hover:text-primary-900"
            data-testid="report-metadata-verify-link"
          >
            Open verification page
          </a>
          <p class="mt-1 text-xs text-text-secondary">
            QR codes on the PDF link to this page to confirm document integrity.
          </p>
        </dd>
      </div>
    </dl>
  </div>
</template>
