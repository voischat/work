import { defineConfig } from 'void/config'

export default defineConfig({
  target: 'cloudflare',
  output: 'static',
  inference: {
    appType: 'static',
    outputDir: '.vitepress/dist',
    build: 'pnpm run docs:build',
  },
  cloudflare: {
    name: 'weila-work-docs',
    account_id: 'f1aeb479314b25d24bd6626e9e5bbfe9',
  },
})
