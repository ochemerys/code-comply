<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UserMenu from './UserMenu.vue'
import { useRouteBreadcrumb } from '../composables/useRouteBreadcrumb'

defineProps<{
  showNavToggle?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-mobile-sidebar'): void
}>()

const { items } = useRouteBreadcrumb()
</script>

<template>
  <header
    class="sticky top-0 z-20 shrink-0 border-b border-border-subtle bg-bg-surface"
    data-testid="admin-header"
  >
    <div class="flex min-h-[3.25rem] items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <button
          v-if="showNavToggle"
          type="button"
          class="rounded-lg p-2 text-text-secondary hover:bg-bg-app md:hidden"
          aria-label="Open navigation"
          data-testid="mobile-nav-open"
          @click="emit('toggle-mobile-sidebar')"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <nav class="min-w-0" aria-label="Breadcrumb" data-testid="breadcrumb">
          <ol class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <li
              v-for="(item, index) in items"
              :key="`${item.to}-${index}`"
              class="flex min-w-0 items-center gap-2"
            >
              <RouterLink
                v-if="index < items.length - 1"
                :to="item.to"
                class="truncate text-base font-medium text-primary-600 hover:text-primary-700 sm:text-lg"
              >
                {{ item.label }}
              </RouterLink>
              <span
                v-else
                class="truncate text-lg font-semibold text-text-primary sm:text-xl"
                data-testid="page-title"
                aria-current="page"
              >
                {{ item.label }}
              </span>
              <span
                v-if="index < items.length - 1"
                class="shrink-0 text-base text-text-dim sm:text-lg"
                aria-hidden="true"
              >
                /
              </span>
            </li>
          </ol>
        </nav>
      </div>

      <UserMenu />
    </div>
  </header>
</template>
