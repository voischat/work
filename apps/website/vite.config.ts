import { writeFile } from 'node:fs/promises'
import path, { resolve } from 'node:path'
import process from 'node:process'
import { vitePluginForArco as Arco } from '@arco-plugins/vite-vue'
import ViteYaml from '@modyfi/vite-plugin-yaml'
import Vue from '@vitejs/plugin-vue'
import { VueAmapResolver } from '@vuemap/unplugin-resolver'
import RadixVueResolver from 'radix-vue/resolver'
import UnoCSS from 'unocss/vite'
import Unused from 'unplugin-unused/vite'
import { ArcoResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

import Layouts from 'vite-plugin-vue-layouts'

const now = Date.now()

export default defineConfig(() => {
  const isDev = process.env.NODE_ENV !== 'production'
  const apiOrigin = process.env.WEILA_API_ORIGIN
    || process.env.WEILA_V2_PROXY
    || (isDev ? 'https://192.168.0.106' : 'https://api.voischat.cn')

  return {
    base: './',

    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          advancedChunks: {
            groups: [
              {
                test: '/node_modules\/browser-image-compression/',
                name: 'browser-image-compression',
              },
            ],
          },
        },
      },
    },

    resolve: {
      alias: {
        '~/': `${path.resolve(__dirname, 'src')}/`,
      },
      extensions: ['.ts', '.js'],
    },

    define: {
      'process.env': {},
      '__BUILD_TIME__': now,
    },

    optimizeDeps: {
      include: [
        '@vois/weila-sdk-core',
        'crypto-js',
      ],
      exclude: [
        '@vois/weila-sdk-ui',
      ],
    },

    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            hack: `true; @import (reference) "${resolve(
              'src/assets/style/breakpoint.less',
            )}";`,
          },
          javascriptEnabled: true,
        },
      },
    },

    server: {
      cors: true,
      proxy: {
        '/v1': {
          target: apiOrigin,
          timeout: 20 * 1000,
          changeOrigin: true,
          secure: false,
        },
        '/v2': {
          target: apiOrigin,
          timeout: 20 * 1000,
          changeOrigin: true,
          secure: false,
        },
        '/voischat': {
          target: apiOrigin,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },

    plugins: [
      ViteYaml(),

      UnoCSS(),

      // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
      Layouts({
        layoutsDirs: 'src/layout',
        defaultLayout: 'default',
      }),

      // https://github.com/antfu/unplugin-vue-components
      Components({
        extensions: ['vue', 'md'],
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        dts: 'src/components.d.ts',
        resolvers: [
          RadixVueResolver(),
          VueAmapResolver(),
          ArcoResolver(),
        ],
      }),

      VueMacros({
        plugins: {
          vue: Vue(),
          vueRouter: VueRouter({
            extensions: ['.vue'],
            exclude: ['**/components/**'],
          }),
        },
      }),

      // https://github.com/arco-design/arco-plugins/blob/main/packages/plugin-vite-vue/README.md
      Arco({}),

      mkcert(),

      Unused({
        ignore: ['axios', 'ofetch'],
      }),

      {
        name: 'vite-plugin-build-info',
        async closeBundle() {
          return await writeFile('./dist/build-info.json', JSON.stringify({
            timestamp: now,
          }, null, 2))
        },
      },
    ],
  }
})
