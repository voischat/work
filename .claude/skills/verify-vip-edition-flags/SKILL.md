---
name: verify-vip-edition-flags
description: Prove VIP edition gating (标准版/专业版/旗舰版) in weila-work-web — sidebar graying + hover hints, member/device modal 轨迹/位置共享/1分钟 gating — by mocking only corp/org/get-my-vip per edition with an agent-browser route and asserting the real logged-in UI. Use after changes to SideBar.vue, EditMemberModal.vue, CreateMemberModal.vue, AddDeviceModal.vue, stores/auth.ts, or anything reading vip_supports.
---

# Verify vip-edition-flags

Edition gating hangs entirely on one endpoint. `POST /v2/corp/org/get-my-vip` returns `{errcode:0, errmsg, data:{vip:{vip, vip_name, vip_expired, vip_created, vip_supports[]}}}`. Each `vip_supports` entry `{name, support, quick_support?}` gates UI. This skill mocks ONLY that response per edition and drives everything else against the real backend with a real login, so the gated UI consumes a genuine token and real surrounding data.

## What gates what

| Flag | Surface | Behavior when false |
|---|---|---|
| `track.support` | 轨迹 form item in Edit/CreateMemberModal, AddDeviceModal | form item hidden |
| `track.quick_support` | 1 分钟 radio in the same modals | disabled + hover hint 旗舰版功能 |
| any `name` with `support:false` | SideBar menu item whose route path contains `name` | `arco-menu-disabled` class (grayed) + hover hint 当前版本不支持该功能 |
| same names | router guard on direct URL navigation to a gated route | redirect to `#/contact/org` + warning message; guard fails open while vip data is loading or errored |
| `location.support === false` | 位置共享 switch in the same modals; also grays the 实时位置 sidebar item and its route (path `/workbench/realtime-location` contains `location`) | switch disabled + hover hint 专业版功能 |

Spec matrix: 标准版 disables 实时位置/轨迹 sidebar + modal 轨迹/位置共享; 专业版 disables only 轨迹1分钟; 旗舰版 disables nothing. Absent flag = feature enabled (frontend must stay permissive). Flag vocabulary confirmed on the wire 2026-11-19 (professional account) and agreed with the product owner: `member` (carries `member_batch_create`, dormant — no batch-create UI exists yet), `dept`, `group`, `device` (display removed from the sidebar hover card 2026-11-19 by product decision; the field stays in the type because the backend sends it), `track`, `location`, `api` (`support:false` in professional; inert — no route path contains `api`, it is the server-side open-API entitlement), `message` (gates `/workbench/message` and the `/message` route family — the workbench chat page was renamed from `chat.vue` to `message.vue` 2026-11-19 so the flag's substring match reaches it; all editions keep it `true` per spec).

## Launch + doctor

Same as [verify-weila-work-web](../verify-weila-work-web/SKILL.md): `pnpm dev:prod` from `weila-work/`, wait for the `Local:` line, doctor the login page renders. The script drives whatever the dev server serves — working tree, HMR included.

## Drive

```bash
.claude/skills/verify-vip-edition-flags/verify-edition.sh standard     # mocked 标准版
.claude/skills/verify-vip-edition-flags/verify-edition.sh professional # mocked 专业版 (verbatim real capture)
.claude/skills/verify-vip-edition-flags/verify-edition.sh flagship     # mocked 旗舰版
```

Per edition the script logs in (QA account), installs `network route "**/corp/org/get-my-vip*" --body fixtures/<edition>.json` BEFORE the post-login vip fetch, then asserts sidebar enabled/disabled/hover-hint per item, the home-page vip_name badge, and 轨迹/位置共享/1分钟 state + hover hints in the edit-member, create-member, and add-device modals. Screenshots and `assertions.log` land in `/tmp/weila-vip-verify/<edition>/` (override with `OUT=`). Exit 0 = every assertion passed. Each edition runs in its own agent-browser session (`verify-edition-<edition>`), so the three can run concurrently against one dev server.

## Refreshing fixtures from the real backend

`fixtures/professional.json` is the verbatim real response captured 2026-11-18 (account 70009790, 已认证·专业版). To re-capture after backend changes:

```bash
agent-browser --session <s> network har start
agent-browser --session <s> reload   # after a logged-in session exists
agent-browser --session <s> network har stop /tmp/vip.har
python3 -c "import json;h=json.load(open('/tmp/vip.har'));print([e['response']['content'].get('text','') for e in h['log']['entries'] if 'get-my-vip' in e['request']['url']][0])"
```

Do not reconstruct the request by hand — auth is query-string (`appid/et/sign/uuid/token`, sign = md5 middle-8), and HAR capture needs none of it. Standard/flagship fixtures are the professional capture with flags flipped per the matrix.

## Gotchas

- Arco marks a disabled menu item by CLASS (`arco-menu-disabled`), not `aria-disabled` or the `disabled` attribute. Assert the class.
- Hover hints use the `v-tips` directive: it sets the native `title` attribute on `mouseenter` and clears it on `mouseleave`. Assert by dispatching those events in `eval` and reading `.title`; the a11y snapshot will not show it.
- Wait for the vip response to settle (~3s after login) before asserting menu state — `disabledList` starts empty. All three observers (SideBar, auth store, org.vue) share one TanStack query key, so expect ONE get-my-vip request per page load.
- If the login token is past half-life, the app calls `corp/auth/refresh` before get-my-vip; that request is NOT mocked and must succeed — a stale session bounces to /login.
- `pages/workbench/realtime-location.vue` fabricates demo pins in DEV when the API list is empty — the page can look alive even when gated; assert the route-guard bounce by URL, not by page content.
- The route guard's redirect warning (Arco Message) auto-dismisses in ~3s; the script asserts the URL bounce only.
- The mock only edits the vip response. Anything asserting limits (member_limit etc. in the corp hover card) must extend the fixture, not the script.

## Cleanup

The script traps EXIT: unroutes and closes its own session. Stop the dev server you started (background task or `kill %<job>`), never by process name.
