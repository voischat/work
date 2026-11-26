// Shared 106 LAN test-account pool for the weila-work verify skills. Import by
// absolute path from a CFG prelude; see verify-account-pool/SKILL.md.
// Account number + WEILA_POOL_PASSWORD authenticate the pool; the app sends the
// password md5 itself, so callers always pass the plaintext value.

import { clearSession, loginHere } from './ego-driver.mjs'

export const TIER_ORDER = ['free', 'standard', 'professional', 'flagship']

export const POOL = [
  { tier: 'free', account: '16675440001', userNumber: 70011006, orgName: '微喇免费版' },
  { tier: 'standard', account: '16675440002', userNumber: 70013221, orgName: '微喇标准版' },
  { tier: 'professional', account: '16675440003', userNumber: 70014141, orgName: '微喇专业版' },
  { tier: 'flagship', account: '16675440004', userNumber: 70015016, orgName: '微喇旗舰版' },
]

export function getPool(env = process.env) {
  let list = POOL
  if (env.WEILA_POOL_JSON) {
    const parsed = JSON.parse(env.WEILA_POOL_JSON)
    if (!Array.isArray(parsed))
      throw new Error('WEILA_POOL_JSON must be a JSON array of { tier, account, userNumber, orgName }')
    list = parsed
  }
  const byTier = new Map(list.map((entry) => [entry.tier, entry]))
  const missing = TIER_ORDER.filter((tier) => !byTier.has(tier))
  if (missing.length)
    throw new Error(`account pool is missing tiers: ${missing.join(', ')}`)
  return TIER_ORDER.map((tier) => byTier.get(tier))
}

export function poolPassword(env = process.env) {
  const password = env.WEILA_POOL_PASSWORD
  if (!password)
    throw new Error('WEILA_POOL_PASSWORD is not set; it lives in ~/.voischat/env.sh (source it first)')
  return password
}

// Injected at document start so a reload cannot discard the capture (a cold
// Vite dependency re-optimization reloads the page mid-login).
const CAPTURE_SOURCE = `(() => {
  window.__poolCap = { login: null, vip: null };
  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    const req = args[0];
    const url = typeof req === "string" ? req : (req && req.url) || String(req);
    let body = null;
    try { body = args[1] && args[1].body; } catch {}
    const res = await origFetch.apply(window, args);
    try {
      const text = await res.clone().text();
      if (/auth\\/login/.test(url)) window.__poolCap.login = { url, body, text };
      if (/org\\/get-vip-membership/.test(url)) window.__poolCap.vip = { url, body, text };
    } catch {}
    return res;
  };
})();`

// Log in from an emptied profile state and capture the login + membership
// traffic. Returns { url, edition, membership }, where membership is
// data.membership of corp/org/get-vip-membership (null when absent).
export async function loginFresh(page, base, entry, password) {
  await clearSession(page, base)
  await page.cdp('Page.enable').catch(() => {})
  const { identifier } = await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: CAPTURE_SOURCE,
  })
  try {
    await page.reload({ timeout: 30000 })
    await page.waitForSelector('input[placeholder="用户名/手机号"]', { timeout: 20000 })
    await loginHere(page, entry.account, password)
    await page.waitForTimeout(4000) // let get-vip-membership settle before reading it

    const readResult = () => page.evaluate(() => {
      const readMembership = () => {
        try {
          const text = window.__poolCap?.vip?.text
          return text ? (JSON.parse(text)?.data?.membership ?? null) : null
        } catch {
          return null
        }
      }
      return {
        url: location.href,
        edition: (document.body.innerText.match(/微喇[一-龥]*版/) || [null])[0],
        membership: readMembership(),
      }
    })

    let result = await readResult()
    if (!result.membership) {
      // The session survives in localStorage, so one reload re-fetches the
      // membership under the injected capture.
      await page.reload({ timeout: 30000 })
      await page.waitForTimeout(4000)
      result = await readResult()
    }
    return result
  }
  finally {
    await page.cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier }).catch(() => {})
  }
}