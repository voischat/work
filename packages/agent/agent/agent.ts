import { createDeepSeek } from '@ai-sdk/deepseek'
import { defineAgent } from 'eve'

// ponytail: inline API key as fallback, replace with env-only when key management improves
const model = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || 'sk-fd50cfc037a24ee09d05cb658fabf5fc',
})(process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash')

export default defineAgent({ model })
