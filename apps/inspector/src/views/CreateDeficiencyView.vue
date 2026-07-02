<script setup lang="ts">
/**
 * CreateDeficiencyView — shell for new deficiency form (M6-S7).
 * Routes match `_docs/user-manuals/inspector-app-user-workflow.md` §3: optional query `checklistItemId`, `refCode`/`refSection`/`refTitle` for code pre-fill.
 * After a successful save, navigates to `deficiency-list` (with the same checklist filter when applicable) so the inspector lands on the review list per §2 step 8.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DeficiencyForm from '@/components/DeficiencyForm.vue'
import type { DeficiencyFormPayload } from '@/components/deficiency-form.types'
import { useDeficiencyMutation } from '@/composables/useDeficiencyMutation'
import { useInspectionReadOnly } from '@/composables/useInspectionReadOnly'
import type { CodeReferenceDTO, CreateDeficiencyDTO } from '@codecomply/validators'

const route = useRoute()
const router = useRouter()
const { createDeficiency } = useDeficiencyMutation()

const isSubmitting = computed(() => createDeficiency.isPending.value)

const inspectionId = computed(() => String(route.params.inspectionId ?? ''))
const checklistItemId = computed(() => {
  const q = route.query.checklistItemId
  return typeof q === 'string' && q.length > 0 ? q : undefined
})

/** Deep-link pre-fill from checklist FAIL flow (M6-S13) */
const initialCreateCodeReference = computed((): CodeReferenceDTO | undefined => {
  const code = route.query.refCode
  const section = route.query.refSection
  if (typeof code !== 'string' || !code.trim() || typeof section !== 'string' || !section.trim()) {
    return undefined
  }
  const title = route.query.refTitle
  return {
    code: code.trim(),
    section: section.trim(),
    ...(typeof title === 'string' && title.trim() ? { title: title.trim() } : {}),
  }
})

const submitError = ref<string | null>(null)

const { isReadOnlyAfterSync } = useInspectionReadOnly({
  inspectionId: computed(() => {
    const id = inspectionId.value.trim()
    return id.length > 0 ? id : undefined
  }),
})

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push({ name: 'home' })
}

async function onSubmit(payload: DeficiencyFormPayload) {
  submitError.value = null
  if (isReadOnlyAfterSync.value) {
    submitError.value = 'This inspection is read-only after finalization sync.'
    return
  }
  try {
    await createDeficiency.mutateAsync({
      clientId: crypto.randomUUID(),
      ...payload,
    } as CreateDeficiencyDTO)
    const id = inspectionId.value
    if (!id) return
    const chk = checklistItemId.value
    await router.replace({
      name: 'deficiency-list',
      params: { inspectionId: id },
      ...(chk ? { query: { checklistItemId: chk } } : {}),
    })
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : 'Could not save deficiency.'
  }
}
</script>

<template>
  <div class="h-full min-h-0 flex flex-col bg-bg-app" data-testid="create-deficiency-view">
    <main class="flex-1 overflow-y-auto px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="mx-auto max-w-lg">
        <div class="mb-6 flex items-center gap-3">
          <button
            type="button"
            class="h-11 min-w-[44px] rounded-lg border border-border-subtle bg-bg-elevated px-3 text-sm font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Go back"
            data-testid="create-deficiency-back"
            @click="goBack"
          >
            Back
          </button>
          <h1 class="text-xl font-semibold text-text-primary">New deficiency</h1>
        </div>

        <p v-if="!inspectionId" class="text-sm text-red-600 dark:text-red-400" role="alert">
          Missing inspection. Use a valid link to create a deficiency.
        </p>

        <template v-else>
          <div
            v-if="isReadOnlyAfterSync"
            class="mb-4 rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3 text-sm text-text-primary"
            data-testid="inspection-read-only-banner"
            role="status"
          >
            This inspection has been finalized and synced. It’s now read-only.
          </div>

          <p
            v-if="submitError"
            class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            data-testid="create-deficiency-submit-error"
            role="alert"
          >
            {{ submitError }}
          </p>

          <div
            class="rounded-2xl border border-border-subtle bg-bg-elevated p-5 shadow-sm dark:shadow-none"
          >
            <DeficiencyForm
              :inspection-id="inspectionId"
              :checklist-item-id="checklistItemId"
              :initial-create-code-reference="initialCreateCodeReference"
              :submitting="isSubmitting"
              :read-only="isReadOnlyAfterSync"
              @submit="onSubmit"
              @cancel="goBack"
            />
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
