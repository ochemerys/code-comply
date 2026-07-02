<!--
  SideNav - Side navigation rail for tablet landscape (≥1024px)
  
  Persistent navigation sidebar with logo, navigation items, and footer.
  Hidden on phone and tablet portrait where bottom nav is used instead.
  
  @component
  @see Mobile-First Design Guide §7.1 - Sidebar (Tablet)
  @see Mobile-First Design Guide §7.0 - Adaptive Navigation Strategy
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppBrandWordmark from './AppBrandWordmark.vue'

const route = useRoute()
const authStore = useAuthStore()
const isGuest = computed(() => !authStore.isAuthenticated)

interface NavItem {
  name: string
  label: string
  icon: string
  path: string
}

const navItems: NavItem[] = [
  {
    name: 'home',
    label: 'Home',
    icon: 'home',
    path: '/',
  },
  {
    name: 'permits',
    label: 'Permits',
    icon: 'map-pin',
    path: '/permits',
  },
  {
    name: 'profile',
    label: 'Profile',
    icon: 'user',
    path: '/profile',
  },
]

const isActive = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<template>
  <!-- Side Navigation (Tablet Landscape Only) - Guide §7.1 -->
  <aside
    class="hidden tablet-l:flex flex-col w-64 bg-bg-surface border-r border-border-subtle h-screen fixed left-0 top-0 z-nav"
    role="navigation"
    aria-label="Main navigation"
  >
    <!-- Brand (single app identity when sidebar is visible) -->
    <div class="h-16 flex items-center px-6 border-b border-border-subtle">
      <router-link
        to="/"
        class="block min-w-0 hover:opacity-90 transition-opacity truncate"
        aria-label="CodeComply Field home"
      >
        <AppBrandWordmark size="md" />
      </router-link>
    </div>

    <!-- Navigation Items -->
    <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.path"
        class="flex items-center gap-3 px-3 h-11 min-h-touch rounded-lg transition-all"
        :class="[
          isActive(item.path)
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700',
        ]"
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <!-- Icon -->
        <svg
          class="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <!-- Home icon -->
          <path
            v-if="item.icon === 'home'"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
          <!-- Map pin icon -->
          <path
            v-else-if="item.icon === 'map-pin'"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <!-- User icon -->
          <path
            v-else-if="item.icon === 'user'"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>

        <!-- Label -->
        <span class="text-sm">{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="px-3 py-4 border-t border-border-subtle space-y-1">
      <!-- User Manual link just above version info -->
      <router-link
        to="/user-manual"
        data-testid="side-nav-user-manual"
        class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
        :class="
          isGuest
            ? 'border border-emerald-300 dark:border-emerald-600 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/35'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
        "
      >
        <span class="flex items-center gap-2 min-w-0">
          <svg
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span>User Manual</span>
        </span>
        <span
          v-if="isGuest"
          class="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200 bg-white/80 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded"
        >
          Public
        </span>
      </router-link>
      <p class="text-xs text-text-dim px-3">v1.0.0</p>
    </div>
  </aside>
</template>
