import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { runWeilaCli } from '../lib/run-cli.js'

export default defineTool({
  description: '分页获取当前登录用户所管理的群组列表。',
  inputSchema: z.object({
    page: z.number().optional().default(1).describe('页码，默认 1'),
    size: z.number().optional().default(20).describe('每页数量，默认 20'),
  }),
  async execute({ page, size }, ctx) {
    const token = ctx.session.auth?.current?.attributes?.token as string | undefined
    return runWeilaCli(['group:list', '--page', String(page), '--size', String(size)], { token })
  },
})
