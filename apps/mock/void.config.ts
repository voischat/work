import { defineConfig } from 'void/config'

export default defineConfig({
  target: 'cloudflare',
  inference: {
    appType: 'void',
    build: 'pnpm run build',
  },
  cloudflare: {
    name: 'work-mock',
    account_id: 'f1aeb479314b25d24bd6626e9e5bbfe9',
  },
})
