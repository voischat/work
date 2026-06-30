<script setup lang="ts">
import { shallowRef } from 'vue'

const sidebarCollapsed = shallowRef(false)
const agentCollapsed = shallowRef(false)
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
      <!-- Agent Chat Panel -->
      <div
        :class="agentCollapsed ? 'w-0 border-l-0 opacity-0' : 'w-[360px] border-l border-neutral-200 opacity-100'"
        class="transition-all duration-300 overflow-hidden shrink-0 h-full"
      >
        <AgentChatPanel />
      </div>
      <a-button
        :class="agentCollapsed ? 'right-0' : 'right-[359px]'"
        class="agent-toggle absolute top-1/2 -translate-y-1/2 z-50 transition-all duration-300"
        size="small"
        @click="agentCollapsed = !agentCollapsed"
      >
        <template #icon>
          <icon-right v-if="agentCollapsed" />
          <icon-left v-else />
        </template>
      </a-button>
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
.sidebar-toggle,
.agent-toggle {
  width: 24px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border-3);
  border-left: 0;
  border-radius: 0 16px 16px 0;
  background: var(--color-bg-2);
  box-shadow: none;
}

.agent-toggle {
  border-left: 1px solid var(--color-border-3);
  border-right: 0;
  border-radius: 16px 0 0 16px;
}

.agent-toggle:has(> span > .icon-left),
.agent-toggle:has(> span > [class*="icon-left"]) {
  border-radius: 16px 0 0 16px;
}
</style>
