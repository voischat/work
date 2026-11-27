// Shared 106 LAN test-account pool for the weila-work verify skills. Typed
// entry scripts import this module; see verify-account-pool/SKILL.md.
// Account number + WEILA_POOL_PASSWORD authenticate the pool; the app sends the
// password md5 itself, so callers always pass the plaintext value.

import process from 'node:process'
import { clearSession, loginHere, type EgoPage } from './ego-driver.ts'
import type { EditionKey } from './edition-expectations.ts'

export interface PoolEntry {
  tier: EditionKey
  account: string
  userNumber: number
  orgName: string
}

export interface Membership {
  name?: string
  level?: number
}

export interface LoginResult {
  url: string
  edition: string | null
  membership: Membership | null
}

export const TIER_ORDER: EditionKey[] = ['free', 'standard', 'professional', 'flagship']

export const POOL: PoolEntry[] = [
  { tier: 'free', account: '16675440001', userNumber: 70011006, orgName: '微喇免费版' },
  { tier: 'standard', account: '16675440002', userNumber: 70013221, orgName: '微喇标准版' },
  { tier: 'professional', account: '16675440003', userNumber: 70014141, orgName: '微喇专业版' },
  { tier: 'flagship', account: '16675440004', userNumber: 70015016, orgName: '微喇旗舰版' },
]

function isPoolEntry(value: unknown): value is PoolEntry {
  return (
    typeof value === 'object'
    && value !== null
    && 'tier' in value
    && typeof value.tier === 'string'
    && 'account' in value
    && typeof value.account === 'string'
    && 'userNumber' in value
    && typeof value.userNumber === 'number'
    && 'orgName' in value
    && typeof value.orgName === 'string'
  )
}

export function getPool(env: NodeJS.ProcessEnv = process.env): PoolEntry[] {
  let list = POOL
  if (env.WEILA_POOL_JSON) {
    const parsed: unknown = JSON.parse(env.WEILA_POOL_JSON)
    if (!Array.isArray(parsed))
      throw new Error('WEILA_POOL_JSON must be a JSON array of { tier, account, userNumber, orgName }')
    list = parsed.map((entry) => {
      if (!isPoolEntry(entry))
        throw new Error('WEILA_POOL_JSON entries must be { tier, account, userNumber, orgName }')
      return entry
    })
  }
  const byTier = new Map(list.map((entry) => [entry.tier, entry]))
  const missing = TIER_ORDER.filter((tier) => !byTier.has(tier))
  if (missing.length)
    throw new Error(`account pool is missing tiers: ${missing.join(', ')}`)
  return TIER_ORDER.map((tier) => {
    const entry = byTier.get(tier)
    if (!entry) throw new Error(`account pool is missing tier ${tier}`)
    return entry
  })
}

export function poolPassword(env: NodeJS.ProcessEnv = process.env): string {
  const password = env.WEILA_POOL_PASSWORD
  if (!password)
    throw new Error('WEILA_POOL_PASSWORD is not set; it lives in ~/.voischat/env.sh (source it first)')
  return password
}

declare global {
  interface Window {
    __poolCap?: {
      login: { url: string; body: unknown; text: string } | null
      vip: { url: string; body: unknown; text: string } | null
    }
  }
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
export async function loginFresh(
  page: EgoPage,
  base: string,
  entry: PoolEntry,
  password: string,
): Promise<LoginResult> {
  await clearSession(page, base)
  await page.cdp('Page.enable').catch(() => {})
  const { identifier } = await page.cdp<{ identifier: string }>(
    'Page.addScriptToEvaluateOnNewDocument',
    { source: CAPTURE_SOURCE },
  )
  try {
    await page.reload({ timeout: 30000 })
    await page.waitForSelector('input[placeholder="用户名/手机号"]', { timeout: 20000 })
    await loginHere(page, entry.account, password)
    await page.waitForTimeout(4000) // let get-vip-membership settle before reading it

    const readResult = (): Promise<LoginResult> => page.evaluate(() => {
      const readMembership = (): Membership | null => {
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
  } finally {
    await page
      .cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier })
      .catch(() => {})
  }
}
