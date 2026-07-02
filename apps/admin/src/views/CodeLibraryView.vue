<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CodeLibraryEntryDTO } from '@codecomply/validators'
import {
  isSessionExpiredRedirectError,
  useAdminCodeLibraryList,
  useCreateCodeLibraryEntryMutation,
  useUpdateCodeLibraryEntryMutation,
  type AdminCodeLibraryFilters,
} from '../composables/useAdminCodeLibrary'

const filters = ref<AdminCodeLibraryFilters>({ query: '', type: '' })
const searchInput = ref('')

let debounce: ReturnType<typeof setTimeout> | undefined
watch(searchInput, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    filters.value = { ...filters.value, query: searchInput.value }
  }, 300)
})

const { data, isPending, isFetching, error } = useAdminCodeLibraryList(filters)
const createMutation = useCreateCodeLibraryEntryMutation()
const updateMutation = useUpdateCodeLibraryEntryMutation()

const loading = computed(() => isPending.value || isFetching.value)
const showError = computed(() => !!error.value && !isSessionExpiredRedirectError(error.value))

const showForm = ref(false)
const editingId = ref<string | null>(null)
const formCode = ref('')
const formSection = ref('')
const formTitle = ref('')
const formDescription = ref('')
const formMessage = ref<string | null>(null)

function resetForm() {
  editingId.value = null
  formCode.value = ''
  formSection.value = ''
  formTitle.value = ''
  formDescription.value = ''
  formMessage.value = null
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(row: CodeLibraryEntryDTO) {
  editingId.value = row.id
  formCode.value = row.code
  formSection.value = row.section
  formTitle.value = row.title ?? ''
  formDescription.value = row.description ?? ''
  formMessage.value = null
  showForm.value = true
}

async function onSave() {
  formMessage.value = null
  try {
    if (editingId.value) {
      await updateMutation.mutateAsync({
        id: editingId.value,
        body: {
          code: formCode.value.trim(),
          section: formSection.value.trim(),
          title: formTitle.value.trim(),
          description: formDescription.value.trim() || undefined,
        },
      })
      formMessage.value = 'Code reference updated.'
    } else {
      await createMutation.mutateAsync({
        code: formCode.value.trim(),
        section: formSection.value.trim(),
        title: formTitle.value.trim(),
        description: formDescription.value.trim() || undefined,
      })
      formMessage.value = 'Code reference added.'
      resetForm()
      showForm.value = false
    }
  } catch (e) {
    formMessage.value = e instanceof Error ? e.message : 'Save failed'
  }
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="code-library-view">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <p class="text-text-secondary">
        Manage safety code references linked from checklist templates (A-03).
      </p>
      <button
        type="button"
        class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 min-h-[44px]"
        data-testid="code-library-add-button"
        @click="openCreate"
      >
        Add Code Reference
      </button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div>
        <label for="code-search" class="block text-sm font-medium text-text-secondary mb-1"
          >Search</label
        >
        <input
          id="code-search"
          v-model="searchInput"
          type="search"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="code-library-search"
        />
      </div>
      <div>
        <label for="code-type" class="block text-sm font-medium text-text-secondary mb-1"
          >Code type</label
        >
        <input
          id="code-type"
          v-model="filters.type"
          type="search"
          placeholder="NBC, NFC, IFC…"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="code-library-type-filter"
        />
      </div>
    </div>

    <div
      v-if="showForm"
      class="rounded-lg border border-border-subtle bg-bg-surface p-4 space-y-3"
      data-testid="code-library-form"
    >
      <h3 class="font-semibold text-text-primary">
        {{ editingId ? 'Edit code reference' : 'Add code reference' }}
      </h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <input
          v-model="formCode"
          type="text"
          placeholder="Code (e.g. NBC 2019)"
          class="rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="code-library-form-code"
        />
        <input
          v-model="formSection"
          type="text"
          placeholder="Section"
          class="rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="code-library-form-section"
        />
      </div>
      <input
        v-model="formTitle"
        type="text"
        placeholder="Title"
        class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        data-testid="code-library-form-title"
      />
      <textarea
        v-model="formDescription"
        rows="3"
        placeholder="Description"
        class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        data-testid="code-library-form-description"
      />
      <div class="flex gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          data-testid="code-library-save-button"
          :disabled="createMutation.isPending.value || updateMutation.isPending.value"
          @click="onSave"
        >
          Save
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-border-strong text-sm"
          @click="showForm = false"
        >
          Cancel
        </button>
      </div>
      <p
        v-if="formMessage"
        class="text-sm text-text-secondary"
        data-testid="code-library-form-message"
      >
        {{ formMessage }}
      </p>
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      data-testid="code-library-error"
    >
      {{ error instanceof Error ? error.message : 'Failed to load code library' }}
    </div>

    <div v-if="loading" class="text-sm text-text-secondary" data-testid="code-library-loading">
      Loading codes…
    </div>

    <div
      v-else
      class="hidden rounded-lg border border-border-subtle overflow-hidden bg-bg-surface shadow md:block"
      data-testid="code-library-desktop"
    >
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm" data-testid="code-library-table">
          <thead class="bg-bg-app border-b border-border-subtle">
            <tr class="text-left text-text-secondary">
              <th class="px-4 py-3 font-medium">Code</th>
              <th class="px-4 py-3 font-medium">Section</th>
              <th class="px-4 py-3 font-medium">Title</th>
              <th class="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data ?? []"
              :key="row.id"
              class="border-b border-border-subtle last:border-0"
              :data-testid="`code-library-row-${row.id}`"
            >
              <td class="px-4 py-3 font-medium text-text-primary">{{ row.code }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ row.section }}</td>
              <td class="px-4 py-3 text-text-secondary">{{ row.title }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="text-primary-600 hover:text-primary-800 text-sm font-medium"
                  @click="openEdit(row)"
                >
                  Edit
                </button>
              </td>
            </tr>
            <tr v-if="(data ?? []).length === 0">
              <td colspan="4" class="px-4 py-8 text-center text-text-dim">
                No code references match your filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ul v-if="!loading" class="space-y-3 md:hidden" data-testid="code-library-mobile" role="list">
      <li
        v-for="row in data ?? []"
        :key="row.id"
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
        :data-testid="`code-library-card-${row.id}`"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-text-primary">{{ row.code }}</p>
            <p class="text-xs text-text-secondary">{{ row.section }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-primary-600 hover:text-primary-800"
            :data-testid="`code-library-card-edit-${row.id}`"
            @click="openEdit(row)"
          >
            Edit
          </button>
        </div>
        <p class="mt-2 text-sm text-text-secondary">{{ row.title }}</p>
      </li>
      <li
        v-if="(data ?? []).length === 0"
        class="rounded-lg border border-border-subtle bg-bg-surface px-4 py-8 text-center text-text-dim"
        data-testid="code-library-mobile-empty"
      >
        No code references match your filters.
      </li>
    </ul>
  </div>
</template>
