// verify-edition.ts — prove VIP edition gating in weila-work-web under a
// mocked corp/org/get-vip-membership payload, driving the real UI like a user through
// ego-browser. The shell wrapper pipes a JS bootstrap that sets globalThis.CFG
// and imports this module; see verify-edition.sh for usage and evidence
// locations.
//
// The mock intercepts ONLY get-vip-membership; everything else (login, member list,
// self-info) hits the real backend, so the gated UI consumes a real login
// token and real surrounding data.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import * as driver from '../lib/ego-driver.ts'
import type { CapturedRequest, EgoTask } from '../lib/ego-driver.ts'
import { EDITIONS } from '../lib/edition-expectations.ts'

interface VerifyEditionConfig {
  edition: 'standard' | 'professional' | 'flagship'
  base: string
  outDir: string
  fixturePath: string
  account: string
  password: string
}

interface ModalState {
  error?: string
  track?: 'present' | 'absent'
  fast?: string
  fastTitle?: string
  loc?: string
  locDisabled?: boolean | null
  locChecked?: boolean | null
  locTitle?: string
}

declare const CFG: VerifyEditionConfig
declare const taskSpace: (name: string) => EgoTask

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const ed = EDITIONS[CFG.edition]
mkdirSync(CFG.outDir, { recursive: true })
const lines: string[] = []
const note = (line: string): void => {
  lines.push(line)
  console.log(line)
}
const failures = (): number => lines.filter((l) => l.startsWith('FAIL')).length

const fixtureB64 = readFileSync(CFG.fixturePath).toString('base64')
const task = await taskSpace(`weila-vip-${CFG.edition}-${Math.floor(Date.now() / 1000)}`)
const page = task.page('p1')
const { pump, requests } = driver.makePump(page, (url) =>
  url.includes('corp/org/get-vip-membership') ? { bodyB64: fixtureB64 } : null,
)

await page.cdp('Network.enable')
// Arm the mock before login so the post-login vip fetch is served from the
// fixture (the app queries get-vip-membership once the token lands).
await page.cdp('Fetch.enable', {
  patterns: [{ urlPattern: '*corp/org/get-vip-membership*', requestStage: 'Request' }],
})

let fatal: string | null = null
try {
  let landed: string
  try {
    landed = await driver.ensureLogin(page, CFG.base, CFG.account, CFG.password, 0)
  } catch (error) {
    fatal = `login failed: ${messageOf(error)}`
    throw error
  }
  if (!landed.includes('#/login')) note(`PASS logged in (${driver.scrubUrl(landed)})`)
  else {
    note(`FAIL login did not land on console (${landed})`)
  }

  const served = await driver.settlePump(page, pump)
  if (served >= 1) note(`PASS mocked get-vip-membership served (${served}x)`)
  else note('FAIL get-vip-membership never reached the mock — assertions below are meaningless')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: join(CFG.outDir, 'sidebar.png') })

  const sidebarState = (item: string): Promise<string> =>
    page.evaluate((name) => {
      const el = [...document.querySelectorAll('.arco-menu-item')].find(
        (x) => x.textContent.trim() === name,
      )
      return el ? (el.className.includes('arco-menu-disabled') ? 'disabled' : 'enabled') : 'missing'
    }, item)
  const hoverTitle = (item: string): Promise<string> =>
    page.evaluate((name) => {
      const el = [...document.querySelectorAll('.arco-menu-item')].find(
        (x) => x.textContent.trim() === name,
      )
      if (!el) return ''
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
      const t = el.title
      el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
      return t || ''
    }, item)

  for (const item of ed.sidebarDisabled) {
    const st = await sidebarState(item)
    if (st === 'disabled') note(`PASS sidebar ${item} disabled`)
    else note(`FAIL sidebar ${item} expected disabled, got '${st}'`)
    const tt = await hoverTitle(item)
    if (tt) note(`PASS sidebar ${item} hover hint '${tt}'`)
    else note(`FAIL sidebar ${item} has no hover hint`)
  }
  for (const item of ed.sidebarEnabled) {
    const st = await sidebarState(item)
    if (st === 'enabled') note(`PASS sidebar ${item} enabled`)
    else note(`FAIL sidebar ${item} expected enabled, got '${st}'`)
  }

  // Read the edition from the sidebar VIP card ("会员等级" row). A whole-body
  // text scan is unreliable when the corp itself is named after an edition
  // (the 106 pool orgs are named 微喇标准版/微喇旗舰版 ...). The sidebar uses
  // UnoCSS attributify syntax, so the trigger carries no class to match.
  const hoverCorp = await page.evaluate(() => {
    const trigger = document.querySelector('.arco-menu [cursor-pointer]')
    if (!trigger) return false
    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    return true
  })
  if (hoverCorp) await page.waitForTimeout(500)
  const badge = await page.evaluate(() => {
    const popup = [...document.querySelectorAll('.arco-trigger-popup')]
      .find(p => (p.textContent || '').includes('会员等级'))
    if (!popup) return 'none'
    const match = (popup.textContent || '').match(/会员等级(.+?)会员生效时间/)
    return match ? match[1].trim() : 'none'
  })
  if (badge === ed.name) note(`PASS home shows ${ed.name}`)
  else note(`FAIL home vip name '${badge}' != '${ed.name}'`)

  const modalState = async (
    hashRoute: string,
    trigger: string,
    shot: string,
    triggerXpath?: string,
  ): Promise<ModalState> => {
    await page.evaluate((h) => {
      location.hash = h
    }, hashRoute)
    await page.waitForTimeout(4000)
    await page.click(triggerXpath ?? `xpath=(//*[text()="${trigger}"])[1]`, { label: `open ${trigger} dialog` })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: join(CFG.outDir, `${shot}.png`) })
    return await page.evaluate(() => {
      const m = [...document.querySelectorAll('.arco-modal')]
        .filter((x) => x.offsetParent !== null)
        .pop()
      if (!m) return { error: 'no visible modal' }
      const labelEls = [...m.querySelectorAll('.arco-form-item-label')]
      const labels = labelEls.map((l) => l.textContent.trim())
      const track = labels.some((l) => l.includes('轨迹'))
      const fast = [...m.querySelectorAll('label')].find((x) => x.textContent.includes('1 分钟'))
      let fastState = 'absent'
      let fastTitle = ''
      if (fast) {
        fastState =
          fast.hasAttribute('disabled') || fast.querySelector('input[disabled]')
            ? 'disabled'
            : 'enabled'
        fast.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
        fastTitle = fast.title || ''
        fast.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
      }
      const locEl = labelEls.find((l) => l.textContent.includes('位置共享'))
      const locRow = locEl ? locEl.closest('.arco-form-item') || locEl.parentElement : null
      const locSwitch = locRow ? locRow.querySelector('.arco-switch') : null
      let locTitle = ''
      if (locSwitch) {
        locSwitch.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
        locTitle = locSwitch.title || ''
        locSwitch.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
      }
      return {
        track: track ? 'present' : 'absent',
        fast: fastState,
        fastTitle,
        loc: locSwitch ? 'present' : 'absent',
        locDisabled: locSwitch
          ? locSwitch.className.includes('disabled')
            || Boolean(locSwitch.querySelector('input[disabled]'))
          : null,
        locChecked: locSwitch
          ? locSwitch.getAttribute('aria-checked') === 'true'
          : null,
        locTitle,
      }
    })
  }
  const closeModals = (): Promise<void> =>
    page.evaluate(() => {
      [...document.querySelectorAll('.arco-modal .arco-modal-close-btn')]
        .filter((b) => b.offsetParent !== null)
        .forEach((b) => b.click())
    })

  const checkModal = async (
    surface: string,
    hashRoute: string,
    trigger: string,
    shot: string,
    triggerXpath?: string,
  ): Promise<void> => {
    const s = await modalState(hashRoute, trigger, shot, triggerXpath)
    await closeModals()
    await page.waitForTimeout(1000)
    if (s.error) {
      note(`FAIL ${surface}: ${s.error}`)
      return
    }
    const chk = (cond: boolean, msg: string): void =>
      note(`${cond ? 'PASS' : 'FAIL'} ${surface} ${msg}`)
    chk(s.track === ed.editTrack, `轨迹 ${s.track} (expect ${ed.editTrack})`)
    chk(s.fast === ed.fast, `1分钟 ${s.fast} (expect ${ed.fast})`)
    if (ed.fastTitle) chk((s.fastTitle ?? '').includes(ed.fastTitle), `1分钟 hover '${s.fastTitle}'`)
    chk(s.loc === 'present', `位置共享 ${s.loc}`)
    chk(
      String(s.locDisabled) === String(ed.locDisabled),
      `位置共享 disabled=${s.locDisabled} (expect ${ed.locDisabled})`,
    )
    if (ed.locDisabled) chk(s.locChecked === false, `位置共享 off while disabled (checked=${s.locChecked})`)
    else note(`INFO ${surface} 位置共享 checked=${s.locChecked} (unlocked)`)
    if (ed.locTitle) chk((s.locTitle ?? '').includes(ed.locTitle), `位置共享 hover '${s.locTitle}'`)
    else chk(s.locTitle === '', `位置共享 no hover hint when enabled`)
  }

  await checkModal(
    'edit-member',
    '#/contact/member',
    '编辑',
    'edit-member-modal',
    'xpath=(//tr[.//span[contains(@class,"arco-tag-green")]]//*[text()="编辑"])[1]',
  )
  await checkModal('create-member', '#/contact/member', '创建成员', 'create-member-modal')
  await checkModal('add-device', '#/contact/member', '新增设备', 'add-device-modal')

  // blocked = navigation bounces off the gated route; allowed = it stays.
  for (const [hashRoute, expected] of ed.routeGuards) {
    await page.goto(`${CFG.base}/${hashRoute}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await driver.settlePump(page, pump)
    await page.waitForTimeout(4000)
    const u = await page.url()
    const stayed = u.includes(hashRoute)
    const ok = expected === 'blocked' ? !stayed : stayed
    if (ok) note(`PASS route-guard ${hashRoute} ${expected}`)
    else note(`FAIL route-guard ${hashRoute} expected ${expected}, landed ${u}`)
  }
} catch (error) {
  if (fatal) note(`FAIL ${fatal}`)
  else note(`FAIL unexpected error: ${messageOf(error)}`)
} finally {
  await page.cdp('Fetch.disable').catch(() => {})
  const vipLines = [...requests.values()]
    .filter((r: CapturedRequest) => r.url.includes('get-vip-membership'))
    .map(
      (r) =>
        `[${new Date(r.ts).toISOString()}] ${r.method} ${driver.scrubUrl(r.url)} ${r.status ?? '…'}`,
    )
  writeFileSync(join(CFG.outDir, 'requests.txt'), `${vipLines.join('\n')}\n`)
  note(`EVIDENCE screenshots, assertions.log, requests.txt in ${CFG.outDir}`)
  const rc = failures()
  note(`RESULT ${CFG.edition} failures=${rc}`)
  writeFileSync(join(CFG.outDir, 'assertions.log'), `${lines.join('\n')}\n`)
  process.exitCode = rc === 0 ? 0 : 1
  if (rc === 0) await task.finish({ keep: [] })
  else
    console.log(
      `space ${task.spaceId} left open for debugging; finish it with taskSpace(${task.spaceId}).finish({keep:[]})`,
    )
}
