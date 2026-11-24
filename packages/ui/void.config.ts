import { defineConfig } from 'void/config'

export default defineConfig({
  target: 'cloudflare',
  output: 'static',
  inference: {
    appType: 'spa',
    outputDir: 'storybook-static',
    build: 'pnpm run build:story',
  },
  routing: {
    notFound: 'single-page-application',
  },
  cloudflare: {
    name: 'weila-work-sdk-ui',
    account_id: 'f1aeb479314b25d24bd6626e9e5bbfe9',
  },
})
