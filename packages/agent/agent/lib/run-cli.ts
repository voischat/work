import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface RunCliOptions {
  /** 可选的 access token；传入时会作为 --token 选项传给 CLI */
  token?: string
  /** CLI profile 名 */
  profile?: string
}

export async function runWeilaCli(args: string[], options: RunCliOptions = {}): Promise<unknown> {
  const { token, profile = 'default' } = options

  const fullArgs = ['exec', 'weila-work-cli', '--profile', profile]
  if (token)
    fullArgs.push('--token', token)
  fullArgs.push(...args, '--json')

  const { stdout } = await execFileAsync(
    'pnpm',
    fullArgs,
    {
      timeout: 30000,
      env: { ...process.env, FORCE_COLOR: '0' },
    },
  )
  return JSON.parse(stdout)
}
