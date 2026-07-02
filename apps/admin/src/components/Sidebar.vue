<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { navIconPath } from './nav-icons'
import { useAdminPermissions } from '../composables/useAdminPermissions'

defineProps<{
  collapsed: boolean
  mobileOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-collapse'): void
  (e: 'close-mobile'): void
}>()

const route = useRoute()
const { visibleNavItems } = useAdminPermissions()

function isNavActive(path: string) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path === path || route.path.startsWith(`${path}/`)
}

function linkClasses(active: boolean) {
  return [
    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    active ? 'bg-primary-50 text-primary-800' : 'text-text-secondary hover:bg-bg-app',
  ]
}

function testIdForRoute(path: string) {
  if (path === '/') {
    return 'nav-home'
  }
  return `nav-${path.replace(/^\//, '').replace(/\//g, '-')}`
}
</script>

<template>
  <!-- Column flex + flex-1 aside: full row height without fragile h-% (M9-S2-B2) -->
  <div data-testid="sidebar-shell" class="flex flex-col shrink-0 self-stretch min-h-0">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-black/40 z-30 md:hidden"
      aria-hidden="true"
      data-testid="sidebar-backdrop"
      @click="emit('close-mobile')"
    />

    <aside
      data-testid="admin-sidebar"
      :class="[
        'fixed md:static inset-y-0 left-0 z-40 flex flex-col flex-1 min-h-0 bg-bg-surface border-r border-border-subtle transition-all duration-200 ease-out',
        collapsed ? 'w-[4.5rem]' : 'w-56',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      ]"
    >
      <div
        class="flex min-h-[3.25rem] shrink-0 items-center border-b border-border-subtle"
        :class="collapsed ? 'justify-center px-2' : 'justify-end gap-1 px-2'"
      >
        <button
          type="button"
          class="hidden rounded-lg p-2 text-text-secondary hover:bg-bg-app md:inline-flex"
          :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
          data-testid="sidebar-collapse-toggle"
          @click="emit('toggle-collapse')"
        >
          <svg
            v-if="collapsed"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          type="button"
          class="rounded-lg p-2 text-text-secondary hover:bg-bg-app md:hidden"
          aria-label="Close navigation"
          data-testid="sidebar-mobile-close"
          @click="emit('close-mobile')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Main navigation">
        <RouterLink
          v-for="item in visibleNavItems"
          :key="item.route"
          :to="item.route"
          :class="linkClasses(isNavActive(item.route))"
          :data-testid="testIdForRoute(item.route)"
          @click="emit('close-mobile')"
        >
          <svg
            class="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="navIconPath(item.icon)"
            />
          </svg>
          <span :class="collapsed ? 'sr-only' : ''">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>
  </div>
</template>
