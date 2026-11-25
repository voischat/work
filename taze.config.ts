import { defineConfig } from 'taze'

export default defineConfig({
  exclude: ['cropperjs'],
  force: true,
  write: true,
  install: true,
  ignorePaths: ['**/node_modules/**', '**/test/**', 'packages/core'],
  ignoreOtherWorkspaces: true,
  packageMode: {
    typescript: 'major',
    '/vue/': 'latest',
  },
  depFields: {
    overrides: false,
  },
})
