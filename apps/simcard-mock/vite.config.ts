import { defineConfig } from 'vite'
import { voidPlugin } from 'void'

export default defineConfig({
  server: {
    port: 8790,
    strictPort: true,
  },
  plugins: [voidPlugin()],
})
