// verify-pool.mjs — prove the 106 LAN account pool logs in and renders the
// membership tier each org holds. Piped to `ego-browser nodejs` behind a CFG
// prelude by verify-pool.sh; see that wrapper for usage and preconditions.

const { writeFileSync, mkdirSync } = await import('node:fs')
const { join } = await import('node:path')
const driver = await import(CFG.libPath)
const pool = await import(CFG.poolLibPath)
const { EDITIONS } = await import(CFG.editionsPath)

mkdirSync(CFG.outDir, { recursive: true })
const lines = []
const note = (line) => {
  lines.push(line)
  console.log(line)
}
const failures = () => lines.filter((l) => l.startsWith('FAIL')).length

const SIDEBAR_ITEMS = ['消息', '实时位置', '轨迹', '应用管理']

const task = await taskSpace(`weila-account-pool-${Math.floor(Date.now() / 1000)}`)
const page = task.page('p1')

let entries = []
try {
  try {
    entries = pool.getPool({ WEILA_POOL_JSON: CFG.poolJson })
  } catch (e) {
    note(`FAIL pool config: ${e.message}`)
  }

  for (const entry of entries) {
    const { tier } = entry
    const ed = EDITIONS[tier]

    let landed
    try {
      landed = await pool.loginFresh(page, CFG.base, entry, CFG.password)
    } catch (e) {
      note(`FAIL ${tier} login: ${e.message}`)
      await page.screenshot({ path: join(CFG.outDir, `${tier}.png`) }).catch(() => {})
      continue
    }
    note(`PASS ${tier} login ${driver.scrubUrl(landed.url)}`)

    const vipName = landed.membership?.name ?? 'none'
    if (vipName === ed.name) note(`PASS ${tier} membership name '${vipName}'`)
    else note(`FAIL ${tier} membership name '${vipName}' != '${ed.name}'`)

    const vipLevel = landed.membership?.level ?? 'none'
    if (vipLevel === ed.level) note(`PASS ${tier} membership level ${vipLevel}`)
    else note(`FAIL ${tier} membership level ${vipLevel} != ${ed.level}`)

    await page.waitForTimeout(2000) // disabledList starts empty; let vip settle
    await page.screenshot({ path: join(CFG.outDir, `${tier}.png`) })

    for (const item of SIDEBAR_ITEMS) {
      const expected = ed.sidebarDisabled.includes(item)
        ? 'disabled'
        : ed.sidebarEnabled.includes(item)
          ? 'enabled'
          : 'missing'
      const actual = await page.evaluate((name) => {
        const el = [...document.querySelectorAll('.arco-menu-item')].find(
          (x) => x.textContent.trim() === name,
        )
        return el ? (el.className.includes('arco-menu-disabled') ? 'disabled' : 'enabled') : 'missing'
      }, item)
      if (actual === expected) note(`PASS ${tier} sidebar ${item} ${actual}`)
      else note(`FAIL ${tier} sidebar ${item} expected ${expected}, got '${actual}'`)
    }
  }
} catch (e) {
  note(`FAIL unexpected error: ${e.message}`)
} finally {
  const rc = failures()
  note(`RESULT accounts=${entries.length} failures=${rc}`)
  writeFileSync(join(CFG.outDir, 'assertions.log'), `${lines.join('\n')}\n`)
  note(`EVIDENCE screenshots and assertions.log in ${CFG.outDir}`)
  await task.finish({ keep: [] })
  process.exitCode = rc === 0 ? 0 : 1
}