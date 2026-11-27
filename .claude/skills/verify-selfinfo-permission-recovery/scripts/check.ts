// check.ts — drive the owner path through a failed token refresh, an SPA
// re-login, and the member edit dialog. Fails unless the 部门管理员 switch is
// enabled after re-login and a token-bearing get-selfinfo request follows the
// login. The shell wrapper pipes a JS bootstrap that sets globalThis.CFG and
// imports this module; see check.sh.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import * as driver from '../../lib/ego-driver.ts'
import type { EgoTask } from '../../lib/ego-driver.ts'

interface VerifySelfInfoConfig {
  base: string
  account: string
  password: string
  evidenceDir: string
}

declare const CFG: VerifySelfInfoConfig
declare const taskSpace: (name: string) => EgoTask

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

mkdirSync(CFG.evidenceDir, { recursive: true })
const lines: string[] = []
const note = (line: string): void => {
  lines.push(line)
  console.log(line)
}
const failures = (): number => lines.filter((l) => l.startsWith('FAIL')).length

const task = await taskSpace(`weila-selfinfo-${Math.floor(Date.now() / 1000)}`)
const page = task.page('p1')
const { pump, requests } = driver.makePump(page, null)
await page.cdp('Network.enable')

const switchState = (): Promise<string> =>
  page.evaluate(() => {
    const label = [...document.querySelectorAll('.arco-form-item-label')].find(
      (el) => el.textContent.trim() === '部门管理员',
    )
    const item = label?.closest('.arco-form-item')
    const sw = item?.querySelector('button.arco-switch')
    return sw ? (sw.disabled ? 'disabled' : 'enabled') : 'missing'
  })

// A session the backend rejects bounces back to #/login even after the form
// submitted; log in again whenever the bounce is observed.
const ensureConsole = async (): Promise<void> => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.waitForFunction(
        () => Boolean(document.querySelector('.arco-menu')) || location.hash.includes('#/contact/'),
        undefined,
        { timeout: 15000 },
      )
      return
    } catch {
      if ((await page.url()).includes('#/login'))
        await driver.loginHere(page, CFG.account, CFG.password)
      else throw new Error('console did not render after re-login')
    }
  }
  throw new Error('console did not render after re-login')
}

const openSwitchModal = async (): Promise<string> => {
  await page.evaluate(() => {
    location.hash = '#/contact/member'
  })
  let count = 0
  for (let i = 0; i < 15; i++) {
    if ((await page.url()).includes('#/login')) {
      await driver.loginHere(page, CFG.account, CFG.password)
      await ensureConsole()
      await page.evaluate(() => {
        location.hash = '#/contact/member'
      })
    }
    count = await page.evaluate(
      () =>
        [...document.querySelectorAll('button')].filter(
          (b) => b.textContent.trim() === '编辑' && b.offsetParent !== null,
        ).length,
    )
    if (count > 0) break
    await page.waitForTimeout(1000)
  }
  if (count === 0) throw new Error('member list did not render an 编辑 button')
  for (let i = 1; i <= Math.min(count, 8); i++) {
    await page.click(`xpath=(//button[normalize-space(.)="编辑"])[${i}]`, {
      label: 'open member edit dialog',
    })
    await page.waitForTimeout(1000)
    let state = await switchState()
    // The switch is disabled until get-selfinfo lands: about 0.7s after a
    // reload, and slower when the LAN backend answers late. A disabled reading
    // gets a bounded wait; one that never enables is still a failure.
    for (let wait = 0; state === 'disabled' && wait < 5; wait++) {
      await page.waitForTimeout(1000)
      state = await switchState()
    }
    if (state !== 'missing') return state
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1000)
  }
  throw new Error('no member edit dialog exposed the 部门管理员 switch')
}

const waitForUrl = async (pattern: string, seconds: number): Promise<boolean> => {
  for (let i = 0; i < seconds; i++) {
    if ((await page.url()).includes(pattern)) return true
    await page.waitForTimeout(1000)
  }
  return false
}

const selfinfoTokenCountAfter = (marker: number): number =>
  [...requests.values()].filter(
    (r) => r.url.includes('get-selfinfo') && r.ts > marker && /[?&]token=/.test(r.url),
  ).length

try {
  await driver.ensureLogin(page, CFG.base, CFG.account, CFG.password)
  note(`PASS logged in as ${CFG.account}`)

  const baseline = await openSwitchModal()
  if (baseline !== 'enabled') throw new Error(`baseline: 部门管理员 switch is ${baseline}`)
  await page.screenshot({ path: join(CFG.evidenceDir, 'before-relogin.png') })
  note('PASS baseline: 部门管理员 switch enabled')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)

  const marker = Date.now()
  await page.evaluate(() => {
    localStorage.setItem('login_time', '0')
    localStorage.setItem('refresh_token', 'invalid-refresh-token-for-repro')
  })
  await page.reload({ timeout: 30000 })
  if (!(await waitForUrl('#/login', 20)))
    throw new Error('expired session did not redirect to #/login')
  note('PASS expired session redirected to #/login')

  await driver.loginHere(page, CFG.account, CFG.password)
  await ensureConsole()
  await waitForUrl('#/contact/', 15)

  const after = await openSwitchModal()
  if (after !== 'enabled') throw new Error(`after re-login: 部门管理员 switch is ${after}`)
  await page.screenshot({ path: join(CFG.evidenceDir, 'after-relogin.png') })

  let count = 0
  for (let i = 0; i < 20; i++) {
    await pump(1)
    count = selfinfoTokenCountAfter(marker)
    if (count > 0) break
    await page.waitForTimeout(1000)
  }
  if (count === 0) throw new Error('no token-bearing get-selfinfo request after re-login')

  writeFileSync(
    join(CFG.evidenceDir, 'get-selfinfo.json'),
    JSON.stringify(
      [...requests.values()]
        .filter((r) => r.url.includes('get-selfinfo'))
        .map((r) => ({
          ts: new Date(r.ts).toISOString(),
          method: r.method,
          url: driver.scrubUrl(r.url),
          status: r.status,
        })),
      null,
      2,
    ),
  )

  note('PASS after re-login: 部门管理员 switch enabled')
  note(`PASS self-info refetched after re-login (${count} request(s))`)
  note(`PASS evidence in ${CFG.evidenceDir}`)
} catch (error) {
  note(`FAIL ${messageOf(error)}`)
} finally {
  const rc = failures()
  note(`RESULT selfinfo failures=${rc}`)
  writeFileSync(join(CFG.evidenceDir, 'assertions.log'), `${lines.join('\n')}\n`)
  process.exitCode = rc === 0 ? 0 : 1
  if (rc === 0) await task.finish({ keep: [] })
  else
    console.log(
      `space ${task.spaceId} left open for debugging; finish it with taskSpace(${task.spaceId}).finish({keep:[]})`,
    )
}
