<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ReportVerifyResponseDTO } from '@codecomply/validators'
import { getHonoClientBaseUrl } from '@/lib/api-base'

const route = useRoute()
const reportId = computed(() => String(route.params.reportId ?? ''))
const hashFromQuery = computed(() => String(route.query.hash ?? ''))

const loading = ref(true)
const result = ref<ReportVerifyResponseDTO | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  error.value = null
  result.value = null

  if (!reportId.value || hashFromQuery.value.length !== 64) {
    error.value = 'Invalid verification link — report id and 64-character hash are required.'
    loading.value = false
    return
  }

  try {
    const url = new URL(
      `/api/reports/verify/${encodeURIComponent(reportId.value)}`,
      getHonoClientBaseUrl(),
    )
    url.searchParams.set('hash', hashFromQuery.value)
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Verification request failed (${res.status})`)
    }
    result.value = (await res.json()) as ReportVerifyResponseDTO
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Verification failed'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-bg-app px-4 py-12" data-testid="report-verify-view">
    <div
      class="mx-auto max-w-lg rounded-xl border border-border-subtle bg-bg-surface p-6 shadow-sm"
    >
      <h1 class="text-xl font-bold text-text-primary">Report verification</h1>
      <p class="mt-1 text-sm text-text-secondary">
        Confirm that a PDF matches the SHA-256 hash stored when the report was generated.
      </p>

      <div
        v-if="loading"
        class="mt-6 text-sm text-text-secondary"
        data-testid="report-verify-loading"
      >
        Verifying document…
      </div>

      <div
        v-else-if="error"
        class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        role="alert"
        data-testid="report-verify-error"
      >
        {{ error }}
      </div>

      <div v-else-if="result" class="mt-6 space-y-4">
        <div
          :class="
            result.valid
              ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900'
              : 'rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900'
          "
          data-testid="report-verify-outcome"
        >
          <p class="font-semibold">{{ result.valid ? 'Authentic' : 'Hash mismatch' }}</p>
          <p class="mt-1 text-sm">{{ result.message }}</p>
        </div>

        <dl class="text-sm text-text-secondary">
          <div>
            <dt class="font-medium text-text-dim">Unique report ID</dt>
            <dd class="font-mono text-xs">{{ result.uniqueReportId }}</dd>
          </div>
          <div class="mt-2">
            <dt class="font-medium text-text-dim">Report type</dt>
            <dd>{{ result.type }}</dd>
          </div>
          <div class="mt-2">
            <dt class="font-medium text-text-dim">Generated</dt>
            <dd>{{ new Date(result.generatedAt).toLocaleString() }}</dd>
          </div>
          <div class="mt-2">
            <dt class="font-medium text-text-dim">Stored hash</dt>
            <dd class="break-all font-mono text-xs">{{ result.hash }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>
