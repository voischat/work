import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
  ignorePatterns: [
    'dist/',
    '*.d.ts',
    'pnpm-lock.yaml',
    '**/*.wasm',
    '**/*.wav',
    '.agents/**',
    '.claude/**',
    'apps/website/**',
    '**/__snapshots__/tsnapi/**',
  ],
  overrides: [
    {
      files: ['*.json', '*.jsonc'],
      options: {
        printWidth: 80,
      },
    },
    {
      files: ['*.md'],
      options: {
        proseWrap: 'preserve',
      },
    },
  ],
})
