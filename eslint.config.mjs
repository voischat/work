import antfu from '@antfu/eslint-config'
import vueI18n from '@intlify/eslint-plugin-vue-i18n'
import pluginQuery from '@tanstack/eslint-plugin-query'
import { createSimplePlugin } from 'eslint-factory'
import { createAutoInsert } from 'eslint-plugin-unimport'

const ignores = [
  '**/pages-deprecated/**',
  '**/assets/**',
  '**/components-depercated/**',
  '**/components/ui/**',
  '**/public/**',
  // The SDK packages run on Oxlint/Oxfmt (see oxlint.config.ts).
  'packages/**',
  // The SDK playground keeps the SDK code style and runs on Oxlint too.
  'apps/playground-vue3/**',
  // Agent-runtime scripts: they execute inside ego-browser's embedded Node
  // runtime (top-level await, injected CFG global, console output), not the app.
  '.claude/skills/**/*.mjs',
]

export default antfu(
  {
    formatters: false,
    unocss: false,
    vue: true,
    pnpm: true,
    typescript: true,
    ignores,
  },
  pluginQuery.configs['flat/recommended'],
  // NOTE: disable temporarily
  vueI18n.configs['flat/recommended'].map((i) => ({
    ...i,
    ignores: ['**/webview/**', '**/network/**', '**/*.md', '**/*.md/**'],
  })),
  {
    files: ['apps/website/**/*.vue'],
    rules: {
      '@intlify/vue-i18n/no-raw-text': [
        'warn',
        {
          // Punctuation, separators and the country-code prefix carry no words to translate.
          ignorePattern: '^[^\\p{L}]+$',
          // Legal footer text is the same in every locale.
          ignoreText: ['Copyright © 2025-2026 Voistech All Rights Reserved.', '粤ICP备05000494号'],
        },
      ],
    },
  },
  {
    settings: {
      'vue-i18n': {
        localeDir: './apps/website/locales/*.{json,json5,yaml,yml}', // extens
        messageSyntaxVersion: '^10.0.7',
      },
    },
  },
  createAutoInsert({
    imports: [
      {
        from: 'vue',
        name: 'shallowRef',
      },
      {
        from: 'vue',
        name: 'ref',
        as: 'deepRef',
      },
    ],
    ignores: ['**/webview/**'],
  }),
  createSimplePlugin({
    name: 'no-ref',
    exclude: ['**/*.md', '**/*.md/**'],
    create(context) {
      return {
        CallExpression(node) {
          if (node.callee.type === 'Identifier' && node.callee.name === 'ref') {
            context.report({
              node,
              message: 'Usage of ref() is restricted. Use shallowRef() or deepRef() instead.',
            })
          }
        },
      }
    },
    ignores,
  }),
)
