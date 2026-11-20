<script setup lang="ts">
import { shallowRef } from 'vue'

const sidebarCollapsed = shallowRef(false)
</script>

<template>
  <div h-full grid="~ rows-[min-content_1fr]">
    <div>
      <Navbar />
    </div>
    <div flex of-hidden relative>
      <div
        :class="sidebarCollapsed ? 'w-0 border-r-0' : 'w-[200px] border-r border-neutral-200'"
        class="transition-all duration-300 overflow-hidden shrink-0"
      >
        <SideBar />
      </div>
      <div flex-1 of-auto>
        <router-view />
      </div>
      <a-button
        :class="sidebarCollapsed ? 'left-0' : 'left-[199px]'"
        class="sidebar-toggle absolute top-1/2 -translate-y-1/2 z-50 transition-all duration-300"
        size="small"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <template #icon>
          <icon-right v-if="sidebarCollapsed" />
          <icon-left v-else />
        </template>
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.sidebar-toggle {
  width: 24px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border-3);
  border-left: 0;
  border-radius: 0 16px 16px 0;
  background: var(--color-bg-2);
  box-shadow: none;
}
</style>
