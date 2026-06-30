import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { runWeilaCli } from '../lib/run-cli.js'

export default defineTool({
  description: '分页搜索当前企业的成员列表。支持按姓名/手机号关键词搜索，可按部门 ID 列表过滤。',
  inputSchema: z.object({
    key: z.string().optional().describe('搜索关键词（姓名或手机号）'),
    deptIds: z.array(z.number()).optional().describe('部门 ID 列表'),
    page: z.number().optional().default(1).describe('页码，默认 1'),
    size: z.number().optional().default(20).describe('每页数量，默认 20'),
  }),
  async execute({ key, deptIds, page, size }) {
    const args = ['address:member-list']
    if (key) args.push('--key', key)
    if (deptIds?.length) args.push('--dept-ids', deptIds.join(','))
    args.push('--page', String(page), '--size', String(size))
    return runWeilaCli(args)
  },
})
