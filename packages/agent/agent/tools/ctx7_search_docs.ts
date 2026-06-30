import { Context7 } from '@upstash/context7-sdk'
import { defineTool } from 'eve/tools'
import { z } from 'zod'

export default defineTool({
  description: '使用 Context7 搜索第三方库或框架的最新文档，用于回答 Vue、Vite、Electron、Arco Design Vue、Pinia、TanStack Query 等技术问题。',
  inputSchema: z.object({
    libraryName: z.string().describe('库名，例如 vue、electron、@arco-design/web-vue'),
    query: z.string().describe('具体问题，例如 "如何在主进程创建窗口"'),
    version: z.string().optional().describe('可选版本号，例如 42.5.0'),
  }),
  async execute({ libraryName, query, version }) {
    const apiKey = process.env.CONTEXT7_API_KEY
    if (!apiKey) {
      return { error: 'CONTEXT7_API_KEY 未配置，无法搜索文档。' }
    }

    const ctx7 = new Context7({ apiKey })
    const results = await ctx7.searchLibrary(query, libraryName)
    if (!results.length) {
      return { error: `未在 Context7 索引中找到库 "${libraryName}"` }
    }

    const lib = results[0]
    const libraryId = version ? `${lib.id}/${version}` : lib.id
    const docs = await ctx7.getContext(query, libraryId, { type: 'txt' })

    return {
      libraryId,
      source: lib.name,
      docs,
    }
  },
})
