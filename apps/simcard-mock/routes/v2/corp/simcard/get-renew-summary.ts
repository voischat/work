import { defineHandler } from 'void'
import { ok } from '../../../../src/http'
import { summarize } from '../../../../src/data'

export const POST = defineHandler(() => ok(summarize()))
