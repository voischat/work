import { defineConfig } from 'oxlint'

const SOURCE_FILES = ['**/*.{js,jsx,ts,tsx,mjs,cjs,vue}']

const SLOP_RULES = {
  'slop/max-comment-length': 'error',
  'slop/no-chained-type-assertions': 'error',
  'slop/no-jargon': 'error',
  'slop/no-trivial-functions': 'error',
  'slop/no-trivial-type-aliases': 'error',
  'slop/prefer-jsdoc': 'error',
} as const

const SONAR_RULES = {
  'sonarjs/cognitive-complexity': 'off',
  'sonarjs/no-all-duplicated-branches': 'error',
  'sonarjs/no-collapsible-if': 'error',
  'sonarjs/no-commented-code': 'error',
  'sonarjs/no-dead-store': 'error',
  'sonarjs/no-duplicated-branches': 'error',
  'sonarjs/no-element-overwrite': 'error',
  'sonarjs/no-empty-collection': 'error',
  'sonarjs/no-gratuitous-expressions': 'error',
  'sonarjs/no-identical-conditions': 'error',
  'sonarjs/no-identical-expressions': 'error',
  'sonarjs/no-identical-functions': 'error',
  'sonarjs/no-invariant-returns': 'off',
  'sonarjs/no-inverted-boolean-check': 'error',
  'sonarjs/no-redundant-boolean': 'error',
  'sonarjs/no-redundant-jump': 'error',
  'sonarjs/no-unused-collection': 'error',
  'sonarjs/no-use-of-empty-return-value': 'error',
  'sonarjs/prefer-single-boolean-return': 'error',
} as const

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import'],
  env: {
    browser: true,
    es2024: true,
  },
  categories: {
    correctness: 'error',
    suspicious: 'warn',
    perf: 'warn',
  },
  jsPlugins: [
    {
      name: 'anti-slop',
      specifier: './packages/core/tools/oxlint/anti-slop/index.ts',
    },
    'eslint-plugin-slop',
    'eslint-plugin-sonarjs',
    {
      name: 'no-comments',
      specifier: './tools/lint/no-comments.ts',
    },
  ],
  settings: {
    slop: {
      inspection: 'full',
    },
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.d.ts',
    'pnpm-lock.yaml',
    'packages/core/src/audio/opus.js',
    'packages/core/src/audio/*.worklet.js',
    'packages/core/src/proto/weilapb.js',
    'packages/core/tools/oxlint/anti-slop/**',
    'apps/website/**',
    '.claude/**',
    'docs/**',
    'qa/**',
    'eslint.config.mjs',
    '**/__snapshots__/tsnapi/**',
  ],
  overrides: [
    {
      files: SOURCE_FILES,
      rules: {
        'slop/no-em-dash': 'error',
        'no-await-in-loop': 'off',
        'no-comments/no-comments': 'error',
        ...SLOP_RULES,
        ...SONAR_RULES,
      },
    },
    {
      files: ['packages/core/src/database/**'],
      rules: {
        'unicorn/no-array-reverse': 'off',
      },
    },
    {
      files: ['**/*.vue'],
      plugins: ['vue'],
    },
    {
      files: SOURCE_FILES,
      rules: {
        'import/no-unassigned-import': [
          'warn',
          { allow: ['**/*.css', '**/*.pcss', 'fake-indexeddb/auto'] },
        ],
      },
    },
    {
      files: ['packages/core/src/audio/**'],
      rules: {
        'unicorn/require-post-message-target-origin': 'off',
      },
    },
    {
      files: ['packages/core/tests/**'],
      rules: {
        'no-underscore-dangle': ['warn', { allow: ['__sdk', '__ready'] }],
      },
    },
    {
      files: ['**/test/**', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['apps/playground-vue3/**'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['packages/core/**'],
      rules: {
        'anti-slop/no-array-filter-map': 'warn',
        'anti-slop/no-chained-type-assertions': 'error',
        'anti-slop/no-conditional-empty-object-spread': 'warn',
        'anti-slop/no-known-value-widening': 'warn',
        'anti-slop/no-module-mocking': 'warn',
        'anti-slop/no-object-parameters': 'warn',
        'anti-slop/no-reduce-accumulator-copy': 'warn',
        'anti-slop/no-reflect-apply': 'warn',
        'anti-slop/no-reflect-get': 'warn',
        'anti-slop/no-runtime-typeof': ['warn', { allowInTypeGuards: true }],
        'anti-slop/no-shape-in-symbol-names': 'warn',
        'anti-slop/no-unknown-parameters': 'warn',
        'anti-slop/no-unknown-returns': 'warn',
        'anti-slop/no-unknown-type-aliases': 'warn',
        'anti-slop/no-unsafe-dictionary-type': 'error',
        'anti-slop/no-widen-then-assert': 'error',
        'anti-slop/require-readable-spacing': 'warn',
        'anti-slop/require-safety-comment-for-type-assertion': 'error',
        'typescript/no-unsafe-type-assertion': 'error',
        'no-shadow': 'warn',
        'no-unused-vars': 'warn',
        'import/default': 'warn',
        'typescript/no-useless-default-assignment': 'warn',
        'typescript/no-floating-promises': 'warn',
        'typescript/await-thenable': 'warn',
        'typescript/unbound-method': 'warn',
        'typescript/no-base-to-string': 'warn',
      },
    },
    {
      files: ['packages/core/src/database/db_enum.ts'],
      rules: {
        'typescript/no-unnecessary-type-parameters': 'off',
        'typescript/no-unsafe-type-assertion': 'off',
      },
    },
    {
      files: ['packages/core/src/main/weila_core.ts', 'packages/core/src/audio/weila_audio.ts'],
      rules: {
        'import/default': 'off',
      },
    },
    {
      files: ['packages/core/src/main/weila_type_guards.ts'],
      rules: {
        'typescript/no-unnecessary-type-parameters': 'off',
      },
    },
  ],
})
