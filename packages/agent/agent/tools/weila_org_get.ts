import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { runWeilaCli } from '../lib/run-cli.js'

export default defineTool({
  description: '获取当前登录用户所在企业的基本信息（名称、成员数、部门数、群组数等）。',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const token = ctx.session.auth?.current?.attributes?.token as string | undefined
    return runWeilaCli(['org:get'], { token })
  },
})
