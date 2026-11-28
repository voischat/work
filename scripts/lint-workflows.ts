import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const ACTIONLINT_VERSION = '1.7.7'
const WORKFLOW_DIR = '.github/workflows'

const files = readdirSync(WORKFLOW_DIR)
  .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => join(WORKFLOW_DIR, name))

function run(command: string, args: string[]): number {
  const result = spawnSync(command, [...args, ...files], { stdio: 'inherit' })

  return result.status ?? 1
}

function isAvailable(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, { stdio: 'ignore' })

  return result.status === 0
}

if (isAvailable('actionlint', ['--version'])) process.exit(run('actionlint', []))

if (isAvailable('docker', ['info'])) {
  process.exit(
    run('docker', [
      'run',
      '--rm',
      '-v',
      `${process.cwd()}:/repo`,
      '-w',
      '/repo',
      `rhysd/actionlint:${ACTIONLINT_VERSION}`,
    ]),
  )
}

console.error('actionlint is not installed and Docker is not running')
process.exit(1)
