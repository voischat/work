import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function runWeilaCli(args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(
    'pnpm',
    ['exec', 'weila-work-cli', ...args, '--json'],
    {
      timeout: 30000,
      env: { ...process.env, FORCE_COLOR: '0' },
    },
  )
  return JSON.parse(stdout)
}
