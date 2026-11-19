<script setup lang="ts">
const { t } = useI18n()

definePage({
  meta: {
    name: 'menu.workbench',
  },
})
</script>

<template>
  <div p4>
    <a-breadcrumb>
      <RouterLink to="/workbench">
        <a-breadcrumb-item>{{ t('menu.workbench') }}</a-breadcrumb-item>
      </RouterLink>
    </a-breadcrumb>
  </div>
  <div>
    <div class="grid grid-cols-1 gap-4 px-4 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2">
      <RouterLink
        to="/workbench/user-track"
        class="rounded-lg bg-white p-6 shadow-md transition-shadow duration-300 dark:bg-neutral-800 hover:shadow-lg"
      >
        <div class="mb-4 flex items-center">
          <i class="i-carbon-map mr-3 text-2xl text-primary-600 dark:text-primary-400" />
          <h3 class="text-xl text-gray-900 font-semibold dark:text-gray-100">
            {{ t('workbench.user-track') }}
          </h3>
        </div>
      </RouterLink>

      <RouterLink
        to="/workbench/message"
        class="rounded-lg bg-white p-6 shadow-md transition-shadow duration-300 dark:bg-neutral-800 hover:shadow-lg"
      >
        <div class="mb-4 flex items-center">
          <i class="i-carbon-chat mr-3 text-2xl text-primary-600 dark:text-primary-400" />
          <h3 class="text-xl text-gray-900 font-semibold dark:text-gray-100">
            {{ t('submenu.chat') }}
          </h3>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
