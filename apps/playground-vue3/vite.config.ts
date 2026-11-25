import { existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  assetsInclude: ['**/*.wasm'],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://webapi.weila.hk:8080/',
        changeOrigin: true,
      },
      '/audio': {
        target: 'https://weilaaudio.oss-cn-shenzhen.aliyuncs.com',
        changeOrigin: true,
      },
      '/avatar': {
        target: 'https://weilaavatar.oss-cn-shenzhen.aliyuncs.com',
        changeOrigin: true,
      },
      '/ptt': {
        target: 'https://weilaspeech.oss-cn-shenzhen.aliyuncs.com',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    https: existsSync(path.resolve(__dirname, 'localhost.pem'))
      ? {
          cert: path.resolve(__dirname, 'localhost.pem'),
          key: path.resolve(__dirname, 'localhost-key.pem'),
        }
      : undefined,
  },
})
