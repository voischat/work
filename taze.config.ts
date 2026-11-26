import { defineConfig } from 'taze'

export default defineConfig({
  exclude: ['cropperjs', 'vue-router', 'playwright', '@playwright/test'],
  force: true,
  write: true,
  install: true,
  ignorePaths: ['**/node_modules/**', '**/test/**', 'packages/core'],
  ignoreOtherWorkspaces: true,
  packageMode: {
    typescript: 'minor',
    '/vue/': 'latest',
  },
  depFields: {
    overrides: false,
  },
})
