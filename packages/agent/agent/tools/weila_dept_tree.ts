import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { runWeilaCli } from '../lib/run-cli.js'

export default defineTool({
  description: '获取当前企业的所有部门列表（部门 ID、名称、用户数）。',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const token = ctx.session.auth?.current?.attributes?.token as string | undefined
    return runWeilaCli(['address:dept-tree'], { token })
  },
})
