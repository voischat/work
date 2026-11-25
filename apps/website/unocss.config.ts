import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetExtra } from 'unocss-preset-extra'

export default defineConfig({
  theme: {
    colors: {
      primary: {
        DEFAULT: '#165DFF',
        100: '#d0dfff',
        200: '#a2beff',
        300: '#739eff',
        400: '#457dff',
        500: '#165dff',
        600: '#124acc',
        700: '#0d3899',
        800: '#092566',
        900: '#041333',
      },
    },
  },
  shortcuts: [
    ['list-btn', 'hover:bg-op100 hover:bg-gray-200 dark:hover:bg-#343435 w-full rounded px4 py2 text-start leading-loose bg-op75 transition-all duration-80 active:color-primary visited:color-primary flex items-center gap-2'],
    ['bg-base', 'bg-white dark:bg-dark'],
    ['text-base', 'text-gray-800 dark:text-white'],
    ['position-center', 'position-x-center top-50% translate-y--50%'],
    ['position-x-center', 'left-50% translate-x--50%'],
  ],
  presets: [
    presetWind3(),
    presetAttributify({ }),
    presetIcons({
      scale: 1.2,
    }),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
    presetTypography({
      cssExtend:
      {
        'h1,h2,h3,h4,h5,h6': {
          color: 'orange',
        },
        'blockquote': {
          color: '#bbb',
        },
      },
    }),
    presetExtra(),
  ],
  transformers: [
    transformerVariantGroup(),
    transformerDirectives(),
  ],
})
