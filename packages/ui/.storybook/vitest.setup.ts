import { setupProjectAnnotations } from '@storybook/vue3-vite'
import * as previewAnnotations from './preview'
import { beforeAll } from 'vitest'

export const projectAnnotations = setupProjectAnnotations([previewAnnotations])

beforeAll(() => {})
