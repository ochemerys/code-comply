<!--
  PermitSearch - Search input that filters "Your permit list" below (M4-S9).
  No separate results: the list view shows filtered results. Works offline.
-->
<script setup lang="ts">
defineProps<{
  /** Search query (v-model) */
  searchQuery?: string
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void
}>()

function clearSearch() {
  emit('update:searchQuery', '')
}
</script>

<template>
  <div class="permit-search">
    <div>
      <label
        for="permit-search-input"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Search in your list (by permit number or address)
      </label>
      <div class="relative flex gap-2">
        <input
          id="permit-search-input"
          :value="searchQuery ?? ''"
          type="search"
          autocomplete="off"
          placeholder="e.g. BP-2024-001 or street name"
          class="flex-1 h-11 min-h-[44px] w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          data-testid="permit-search-input"
          aria-label="Search permits by number or address"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="(searchQuery ?? '').length > 0"
          type="button"
          class="flex-shrink-0 h-11 min-h-[44px] px-4 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95 transition-all"
          data-testid="permit-search-clear"
          aria-label="Clear search"
          @click="clearSearch"
        >
          Clear
        </button>
      </div>
      <p
        v-if="(searchQuery ?? '').length > 0 && (searchQuery ?? '').length < 2"
        class="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
      >
        Type at least 2 characters to search
      </p>
    </div>
  </div>
</template>
