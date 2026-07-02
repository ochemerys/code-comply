<!--
  BottomNav - Bottom navigation bar for phone and tablet portrait (<1024px)
  
  Shows 3-5 core navigation items with icons and labels.
  Hidden on tablet landscape (≥1024px) where side navigation is used instead.
  
  @component
  @see Mobile-First Design Guide §7.3 - Bottom Nav (Phone Only)
  @see Mobile-First Design Guide §7.0 - Adaptive Navigation Strategy
-->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
    name: 'user-manual',
    label: 'Help',
    icon: 'book-open',
    path: '/user-manual',
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
  return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <!-- Bottom Navigation (Phone & Tablet Portrait) - Guide §7.3 -->
  <nav
    class="tablet-l:hidden fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border-subtle pb-safe-bottom z-nav"
    role="navigation"
    aria-label="Main navigation"
    data-testid="bottom-nav"
  >
    <div class="flex items-center justify-around h-16">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.path"
        class="flex flex-col items-center justify-center flex-1 h-full min-h-touch transition-colors relative"
        :class="[
          isActive(item.path)
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-text-secondary hover:text-text-primary',
          item.name === 'user-manual' && isGuest && !isActive(item.path)
            ? 'ring-2 ring-inset ring-emerald-400/90 dark:ring-emerald-500/80 rounded-t-lg'
            : '',
        ]"
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <!-- Icon -->
        <svg
          class="w-6 h-6 mb-1"
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
          <!-- Book / help (user manual) -->
          <path
            v-else-if="item.icon === 'book-open'"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>

        <!-- Label -->
        <span class="text-xs font-medium flex items-center gap-1">
          {{ item.label }}
          <span
            v-if="item.name === 'user-manual' && isGuest"
            class="text-[9px] font-bold uppercase leading-none text-emerald-700 dark:text-emerald-300"
          >
            · Open
          </span>
        </span>

        <!-- Active indicator -->
        <div
          v-if="isActive(item.path)"
          class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-primary-600 dark:bg-primary-400 rounded-t-full"
          aria-hidden="true"
        />
      </router-link>
    </div>
  </nav>
</template>
