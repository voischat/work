---
name: verify-account-pool
description: Prove the Weila 106 LAN test-account pool (free/标准版/专业版/旗舰版) logs in through the real console and renders the expected VIP feature flags per account — membership name+level from corp/org/get-vip-membership plus sidebar enabled/disabled state — by driving the real UI with ego-browser against the 106 backend. Use after changes to the login flow, stores/weila.ts, stores/auth.ts, or SideBar.vue, and whenever you need a real per-edition account instead of verify-vip-edition-flags' mocked get-vip-membership payload.
---

# Verify the 106 account pool

## What it proves

Four real accounts on the LAN backend at `https://192.168.0.106` each log in through the console and render the VIP tier their org claims. Per account the run asserts:

- the login lands on `#/contact/` and the captured `corp/auth/login` traffic is a real request,
- `data.membership.name` and `data.membership.level` from the captured `corp/org/get-vip-membership` response equal the tier's entry in `../lib/edition-expectations.ts` (免费版 0 / 标准版 16 / 专业版 32 / 旗舰版 48),
- the four sidebar items 消息/实时位置/轨迹/应用管理 are enabled or grayed per that tier (same `.arco-menu-item` / `arco-menu-disabled` class check as [verify-vip-edition-flags](../verify-vip-edition-flags/SKILL.md)).

The pool lives in `../lib/account-pool.ts` with tiers ordered `free, standard, professional, flagship`. Login is the 11-digit account number plus `WEILA_POOL_PASSWORD`.

## Preconditions

Run the dev profile. `pnpm dev` now points `/v1`, `/v2` and the `/voischat` WebSocket proxy at the 106 backend, and the SDK defaults its WebSocket to the same-origin `/voischat/bridge`, so no environment variables are needed. Pass a unique port when other worktrees run servers:

```bash
pnpm -C apps/website exec vite --port <port> --strictPort
```

`vite.config.ts` proxies all three paths to `WEILA_API_ORIGIN` (alias `WEILA_V2_PROXY`) with `secure: false`, so the self-signed 106 certificate is accepted by the proxy; `VITE_WEB_SOCK` still overrides the bridge URL. The stage profile (`pnpm dev:prod`) points at `https://api.voischat.cn` instead, where the pool accounts do not exist.

`WEILA_POOL_PASSWORD` is required; it lives in `~/.voischat/env.sh`. Source it first, never hardcode it:

```bash
source ~/.voischat/env.sh
```

`WEILA_POOL_JSON` optionally overrides the account list (a JSON array of `{ tier, account, userNumber, orgName }`); every tier must still be present.

## Shared profile

Ego TaskSpaces share one profile's localStorage. Every `loginFresh` empties the origin's storage and signs in as its pool account, so a run signs out whatever else was active on that origin (a person's manual session included) and leaves the last pool account signed in. The other skills are unaffected: their `ensureLogin` reuses a kept session only when it is the account they asked for and replaces any other.

To drive two pool accounts at the same time, use two origins: run two dev servers on different ports and log one account into each. localStorage is per origin and the console keeps its token there rather than in cookies, so the accounts stay isolated inside the same Ego profile.

The four accounts are one per tier corp (free, standard, professional, flagship); they do not share groups or friends. That is enough for edition gating, but a two-party PTT run needs two accounts provisioned inside one corp with a shared group.

## Usage

```bash
.claude/skills/verify-account-pool/verify-pool.sh                 # https://localhost:5173
.claude/skills/verify-account-pool/verify-pool.sh https://localhost:5200
```

Evidence lands in `$OUT` (default `/tmp/weila-account-pool/`): `<tier>.png` per account, `assertions.log`, and `run.log`.

## Exit codes

- `0` — every assertion passed (`RESULT accounts=4 failures=0`).
- `1` — a `FAIL` line landed in `assertions.log`, or no `RESULT ... failures=0` line was written (a crash).
- `2` — `ego-browser` missing or `WEILA_POOL_PASSWORD` unset.

## Expected green run

The 106 backend serves `corp/org/get-vip-membership` with the four tiers provisioned (measured 2026-11-26: 0 免费版 / 16 标准版 / 32 专业版 / 48 旗舰版), so a healthy run ends `RESULT accounts=4 failures=0`. The legacy `corp/org/get-my-vip` endpoint still answers `vip=0 免费版` for every account and must not be used for assertions — a stale branch that reads it will show false red rows. If a row fails, compare the captured `membership` payload first, then the sidebar classes.