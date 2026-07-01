import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { runWeilaCli } from '../lib/run-cli.js'

export default defineTool({
  description: '执行 weila-work-cli 命令。可查询或管理企业信息、部门、成员、群组。详细命令和参数见 weila_work_cli skill 文档。',
  inputSchema: z.object({
    command: z.string().describe('CLI 命令，例如 org:get、address:dept-tree、address:member-list、group:list'),
    args: z.array(z.string()).optional().describe('命令行参数，例如 ["--key", "张三", "--page", "1", "--size", "20"]'),
  }),
  async execute({ command, args }, ctx) {
    const token = ctx.session.auth?.current?.attributes?.token as string | undefined
    const cliArgs = [command, ...(args ?? [])]
    return runWeilaCli(cliArgs, { token })
  },
})
