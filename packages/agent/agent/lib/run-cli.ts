import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
// resolve cli.mjs from the package's dist dir (not in exports)
const mainEntry = import.meta.resolve('weila-work-cli')
const CLI_PATH = join(dirname(fileURLToPath(mainEntry)), 'cli.mjs')

export interface RunCliOptions {
  token?: string
  profile?: string
}

export async function runWeilaCli(args: string[], options: RunCliOptions = {}): Promise<unknown> {
  const { token, profile = 'default' } = options

  const fullArgs = [CLI_PATH, '--profile', profile]
  if (token) fullArgs.push('--token', token)
  fullArgs.push(...args, '--json')

  const { stdout } = await execFileAsync(process.execPath, fullArgs, {
    timeout: 30000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FORCE_COLOR: '0' },
  })
  return JSON.parse(stdout)
}
