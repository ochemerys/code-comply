<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useCodeReference } from '@/composables/useCodeReference'
import CodeReferenceItem from '@/components/CodeReferenceItem.vue'
import type { CodeReference } from '@/lib/db/types'

const emit = defineEmits<{
  (e: 'select', ref: CodeReference): void
}>()

const query = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const { searchResults, recentCodes, isSearching, search, select, clearSearch } = useCodeReference()

const debouncedSearch = useDebounceFn(async (q: string) => {
  await search(q)
}, 300)

watch(query, (raw) => {
  const q = raw.trim()
  if (!q) {
    clearSearch()
    return
  }
  debouncedSearch(q)
})

async function onPick(item: CodeReference) {
  const full = await select(item.code, item.section)
  emit('select', full)
}

function focusSearch() {
  searchInputRef.value?.focus()
}

defineExpose({ focusSearch })
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="code-reference-search">
    <div>
      <label
        for="code-reference-search-input"
        class="block text-sm font-medium text-text-secondary mb-2"
      >
        Search codes
      </label>
      <input
        id="code-reference-search-input"
        ref="searchInputRef"
        v-model="query"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder="Code, section, or keywords"
        class="w-full min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-surface text-text-primary text-base placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid="code-reference-search-input"
      />
      <p
        v-if="isSearching"
        class="mt-2 text-sm text-text-secondary"
        data-testid="code-reference-search-loading"
      >
        Searching…
      </p>
    </div>

    <div v-if="!query.trim() && recentCodes.length > 0" data-testid="code-reference-recent-section">
      <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
        Recent codes
      </h3>
      <ul class="flex flex-col gap-2" data-testid="code-reference-recent-list">
        <li v-for="(r, i) in recentCodes" :key="`${r.code}-${r.section}-${i}`">
          <CodeReferenceItem :item="r" :suffix="`recent-${i}`" @select="onPick(r)" />
        </li>
      </ul>
    </div>

    <div v-if="query.trim()" data-testid="code-reference-results-section">
      <h3 class="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">
        Results
      </h3>
      <ul
        v-if="searchResults.length > 0"
        class="flex flex-col gap-2"
        data-testid="code-reference-results-list"
      >
        <li v-for="(r, i) in searchResults" :key="`${r.code}-${r.section}-${i}`">
          <CodeReferenceItem :item="r" :suffix="`result-${i}`" @select="onPick(r)" />
        </li>
      </ul>
      <p
        v-else-if="!isSearching"
        class="text-sm text-text-secondary py-2"
        data-testid="code-reference-no-results"
      >
        No matching codes. Try another search — cached codes work offline.
      </p>
    </div>
  </div>
</template>
