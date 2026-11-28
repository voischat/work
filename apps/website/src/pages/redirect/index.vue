<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router'

definePage({
  meta: {
    requiresAuth: false,
  },
})

const router = useRouter()
const route = useRoute()

const gotoPath = typeof route.query.path === 'string'
  ? route.query.path
  : '/'

router.replace({ path: gotoPath })
</script>

<template>
  <div />
</template>

<style scoped lang="less"></style>
