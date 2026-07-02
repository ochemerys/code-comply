<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import Sidebar from '../components/Sidebar.vue'
import Header from '../components/Header.vue'
import AppFooter from '../components/AppFooter.vue'
import AsyncLoadingFallback from '../components/AsyncLoadingFallback.vue'

const SIDEBAR_KEY = 'admin_sidebar_collapsed'

const sidebarCollapsed = ref(false)
const mobileSidebarOpen = ref(false)

function readCollapsed() {
  try {
    sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    sidebarCollapsed.value = false
  }
}

function toggleSidebarCollapsed() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

function openMobileSidebar() {
  mobileSidebarOpen.value = true
}

function closeMobileSidebar() {
  mobileSidebarOpen.value = false
}

watch(sidebarCollapsed, (c) => {
  try {
    localStorage.setItem(SIDEBAR_KEY, c ? '1' : '0')
  } catch {
    /* ignore */
  }
})

function onResize() {
  if (window.matchMedia('(min-width: 768px)').matches) {
    mobileSidebarOpen.value = false
  }
}

onMounted(() => {
  readCollapsed()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="min-h-screen bg-bg-app flex items-stretch">
    <Sidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileSidebarOpen"
      @toggle-collapse="toggleSidebarCollapsed"
      @close-mobile="closeMobileSidebar"
    />

    <div class="flex-1 flex flex-col min-w-0 min-h-screen md:ml-0">
      <Header show-nav-toggle @toggle-mobile-sidebar="openMobileSidebar" />
      <div class="min-h-0 w-full max-w-7xl flex-1 mx-auto px-4 py-5 sm:px-6 lg:px-8">
        <RouterView v-slot="{ Component, route }">
          <Suspense>
            <component :is="Component" :key="route.path" />
            <template #fallback>
              <AsyncLoadingFallback label="Loading page…" test-id="route-loading-fallback" />
            </template>
          </Suspense>
        </RouterView>
      </div>
      <AppFooter />
    </div>
  </div>
</template>
