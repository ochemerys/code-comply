<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import type { CodeReferenceDTO } from '@codecomply/validators'
import { searchAdminCodeReferences } from '../composables/useAdminDeficiencies'

const props = defineProps<{
  modelValue?: CodeReferenceDTO
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: CodeReferenceDTO | undefined): void
}>()

const open = ref(false)
const query = ref('')
const results = ref<CodeReferenceDTO[]>([])
const searching = ref(false)
const searchError = ref<string | null>(null)

const summary = computed(() => {
  const c = props.modelValue
  if (!c) return ''
  return c.title ? `${c.code} §${c.section} — ${c.title}` : `${c.code} §${c.section}`
})

const debouncedSearch = useDebounceFn(async (q: string) => {
  if (!q.trim()) {
    results.value = []
    return
  }
  searching.value = true
  searchError.value = null
  try {
    results.value = await searchAdminCodeReferences(q)
  } catch (e) {
    searchError.value = e instanceof Error ? e.message : 'Search failed'
    results.value = []
  } finally {
    searching.value = false
  }
}, 300)

watch(query, (q) => {
  if (!open.value) return
  debouncedSearch(q)
})

function onOpen() {
  if (props.disabled) return
  open.value = true
  query.value = ''
  results.value = []
}

function onClose() {
  open.value = false
}

function onSelect(item: CodeReferenceDTO) {
  emit('update:modelValue', item)
  onClose()
}

function onClear() {
  emit('update:modelValue', undefined)
}
</script>

<template>
  <div class="space-y-2" data-testid="code-reference-picker">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-app disabled:opacity-50"
        data-testid="code-reference-picker-open"
        :disabled="disabled"
        @click="onOpen"
      >
        {{ modelValue ? 'Change code reference' : 'Select from code library' }}
      </button>
      <button
        v-if="modelValue"
        type="button"
        class="text-sm font-medium text-text-secondary hover:text-text-primary"
        data-testid="code-reference-picker-clear"
        :disabled="disabled"
        @click="onClear"
      >
        Clear
      </button>
    </div>
    <p
      v-if="summary"
      class="text-sm text-text-secondary"
      data-testid="code-reference-picker-summary"
    >
      {{ summary }}
    </p>

    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      data-testid="code-reference-picker-dialog"
      @click.self="onClose"
    >
      <div
        class="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border-subtle bg-bg-surface shadow-xl"
        role="dialog"
      >
        <div class="border-b border-border-subtle px-4 py-3">
          <h3 class="text-lg font-semibold text-text-primary">Code library</h3>
          <p class="text-sm text-text-secondary">Search by code, section, or keywords.</p>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <input
            v-model="query"
            type="search"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            placeholder="e.g. fire separation"
            data-testid="code-reference-picker-search"
            autofocus
          />
          <p v-if="searching" class="text-sm text-text-secondary">Searching…</p>
          <p v-else-if="searchError" class="text-sm text-red-700">{{ searchError }}</p>
          <ul v-else-if="results.length" class="divide-y divide-border-subtle">
            <li v-for="(item, i) in results" :key="`${item.code}-${item.section}-${i}`">
              <button
                type="button"
                class="w-full px-2 py-3 text-left text-sm hover:bg-bg-app"
                :data-testid="`code-reference-picker-result-${i}`"
                @click="onSelect(item)"
              >
                <span class="font-medium text-text-primary"
                  >{{ item.code }} §{{ item.section }}</span
                >
                <span v-if="item.title" class="mt-0.5 block text-text-secondary">{{
                  item.title
                }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="query.trim()" class="text-sm text-text-secondary">No matching codes.</p>
        </div>
        <div class="border-t border-border-subtle px-4 py-3 text-right">
          <button
            type="button"
            class="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-text-primary"
            data-testid="code-reference-picker-close"
            @click="onClose"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
