<script setup lang="ts">
import AppHeader from './AppHeader.vue'
import BottomNav from './BottomNav.vue'
import SideNav from './SideNav.vue'
</script>

<template>
  <div
    class="flex h-dvh min-h-svh w-full overflow-hidden bg-bg-app [--app-bottom-nav-height:4rem] [--app-safe-bottom:env(safe-area-inset-bottom,0px)] tablet-l:[--app-bottom-nav-height:0px]"
    data-testid="app-shell"
  >
    <SideNav />

    <div class="flex min-h-0 flex-1 flex-col tablet-l:ml-64">
      <AppHeader />

      <main
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(var(--app-bottom-nav-height)+var(--app-safe-bottom))]"
        data-testid="app-shell-main"
      >
        <slot />
      </main>
    </div>

    <BottomNav />
  </div>
</template>
