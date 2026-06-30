import { deepseek } from '@ai-sdk/deepseek'
import { defineAgent } from 'eve'

export default defineAgent({
  model: deepseek(process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'),
})
