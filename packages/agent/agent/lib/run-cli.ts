import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface RunCliOptions {
  /** 可选的 access token；传入时会先写入 CLI profile 再执行命令 */
  token?: string
  /** CLI profile 名 */
  profile?: string
}

export async function runWeilaCli(args: string[], options: RunCliOptions = {}): Promise<unknown> {
  const { token, profile = 'default' } = options

  // 如果提供了 token，先写入 CLI profile，避免与 web 登录态冲突
  if (token) {
    await execFileAsync(
      'pnpm',
      ['exec', 'weila-work-cli', '--profile', profile, 'auth:set-token', '--token', token, '--json'],
      {
        timeout: 30000,
        env: { ...process.env, FORCE_COLOR: '0' },
      },
    )
  }

  const fullArgs = ['exec', 'weila-work-cli', '--profile', profile, ...args, '--json']
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
