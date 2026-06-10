<script setup lang="ts">
const sidebarCollapsed = ref(false)
</script>

<template>
  <div h-full grid="~ rows-[min-content_1fr]">
    <div>
      <Navbar />
    </div>
    <div flex of-hidden relative>
      <div
        :class="sidebarCollapsed ? 'w-0' : 'w-[200px]'"
        class="transition-all duration-300 overflow-hidden shrink-0"
      >
        <SideBar />
      </div>
      <div flex-1 of-auto>
        <router-view />
      </div>
      <a-button
        :class="sidebarCollapsed ? 'left-2' : 'left-52'"
        class="absolute bottom-4 z-50 transition-all duration-300"
        shape="circle"
        size="small"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        <template #icon>
          <icon-menu />
        </template>
      </a-button>
    </div>
  </div>
</template>
