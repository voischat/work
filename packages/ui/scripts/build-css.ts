import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import autoprefixer from 'autoprefixer'
import postcss, { type Plugin } from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(scriptDir, '..')

const sourceCssPath = resolve(rootDir, 'src/style.postcss.css')
const distCssPath = resolve(rootDir, 'dist/index.css')
const floatingVueCssPath = resolve(rootDir, 'node_modules/floating-vue/dist/style.css')

const unwrapCascadeLayers: Plugin = {
  postcssPlugin: 'unwrap-cascade-layers',
  AtRule: {
    layer(atRule) {
      if (atRule.nodes?.length) {
        atRule.replaceWith(...atRule.nodes)
      } else {
        atRule.remove()
      }
    },
  },
}

const [sourceCss, componentCss, floatingVueCss] = await Promise.all([
  readFile(sourceCssPath, 'utf8'),
  readFile(distCssPath, 'utf8').catch(() => ''),
  readFile(floatingVueCssPath, 'utf8'),
])

const tailwindCss = await postcss([tailwindcss(), autoprefixer(), unwrapCascadeLayers]).process(
  sourceCss,
  {
    from: sourceCssPath,
    to: distCssPath,
  },
)

await writeFile(
  distCssPath,
  [tailwindCss.css, componentCss, floatingVueCss].filter(Boolean).join('\n'),
)
