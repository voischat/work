---
name: verify-vip-edition-flags
description: Prove VIP edition gating (标准版/专业版/旗舰版/终极版) in weila-work-web — sidebar graying + hover hints, member/device modal 轨迹/位置共享/1分钟 gating — by mocking only corp/org/get-vip-membership per edition with an ego-browser CDP Fetch interception and asserting the real logged-in UI. Use after changes to SideBar.vue, EditMemberModal.vue, CreateMemberModal.vue, AddDeviceModal.vue, stores/auth.ts, or anything reading the membership `supports` map, and also when adding or changing any page or endpoint that may be edition-gated: new workbench routes, and any corp endpoint that can return errcode 45112, even when the code never reads `supports`.
---

# Verify vip-edition-flags

Edition gating hangs entirely on one endpoint. `POST /v2/corp/org/get-vip-membership` returns `{errcode:0, errmsg, data:{membership:{level, name, expired, created, <limit fields>, supports:{<flag>: boolean}}}}`. Each `supports` key is a flag that gates UI. This skill mocks ONLY that response per edition and drives everything else against the real backend with a real login, so the gated UI consumes a genuine token and real surrounding data.

## What gates what

| Flag                          | Surface                                                                                                                                          | Behavior when false                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `supports.track`              | 轨迹 form item in Edit/CreateMemberModal, AddDeviceModal                                                                                         | form item hidden. An absent key hides it too                                           |
| `supports.track_quick`        | 1 分钟 radio in the same modals                                                                                                                  | disabled + hover hint 旗舰版功能                                                                     |
| any key with `false`          | SideBar menu item whose route path contains the key                                                                                              | `arco-menu-disabled` class (grayed) + hover hint 需提升 VIP 等级                                |
| same keys                     | router guard on direct URL navigation to a gated route                                                                                           | redirect to `#/contact/org` + warning message; guard fails open while vip data is loading or errored |
| `supports.location === false` | 位置共享 switch in the same modals; also grays the 实时位置 sidebar item and its route (path `/workbench/realtime-location` contains `location`) | switch disabled + hover hint 专业版功能                                                              |
| `supports.api === false`      | route that declares `meta.vip: 'api'`, e.g. `/workbench/application` (`corp/api/manage/*`)                                                       | menu grayed + route-guard bounce via the explicit flag; server also returns errcode 45112            |

Spec matrix: 标准版 disables 实时位置/轨迹/应用管理 sidebar + modal 轨迹/位置共享; 专业版 disables 应用管理 and 轨迹1分钟; 旗舰版 disables nothing. Absent flag = feature enabled (frontend must stay permissive). A route opts into explicit flag gating with `definePage({ meta: { vip: '<flag>' } })`; `isPathVipGated(path, vip, meta.vip)` then checks that flag instead of a path substring. Use it when the route path does not contain the flag name. `meta.vip` is typed as `VipFlag` (`keyof VipSupports` in `stores/auth.ts`), so a flag the contract does not define fails `typecheck`.

Flag vocabulary: `member`, `dept`, `group`, `device` (display removed from the sidebar hover card 2026-11-19 by product decision. The field stays in the type because the backend sends it.), `track`, `track_quick` (it locks only the 1 分钟 radio, and no route path contains it, so it never grays 轨迹), `location`, `api` (`false` in standard/professional and `true` in 旗舰版. It gates routes that declare `meta.vip: 'api'`, e.g. `/workbench/application` for `corp/api/manage/*`. The path does not contain `api`, so gating uses the explicit route meta flag, not substring matching. The server also returns `errcode 45112` when the flag is missing.), `message` (it gates `/workbench/message` and the `/message` route family. The workbench chat page was renamed from `chat.vue` to `message.vue` on 2026-11-19 so the flag's substring match reaches it. All editions keep it `true` per spec.), `member_batch_create` (a flag of its own now. It is dormant because no batch-create UI exists yet.), `simcard` (no route path contains it and no UI reads it).

Provenance: `member` through `message` were confirmed on the wire 2026-11-19 against the previous contract and agreed with the product owner. `api.voischat.cn` has served `corp/org/get-vip-membership` since 2026-11-25, and the flagship capture below confirms the full key set, including `track_quick`, `member_batch_create` and `simcard`, for 旗舰版. No standard or professional response of the new contract has been observed yet.

## Launch + doctor

Same as [verify-weila-work-web](../verify-weila-work-web/SKILL.md): `pnpm dev:prod` from `weila-work/`, wait for the `Local:` line, doctor the login page renders. The script drives whatever the dev server serves — working tree, HMR included.

To test against a backend other than the default, start the server with `WEILA_V2_PROXY=<origin> pnpm dev:prod`; `apps/website/vite.config.ts` reads it for the `/v2` proxy. The LAN integration backend is `192.168.1.29`. It has answered both `https://` with a self-signed certificate and plain `http://`, so use the scheme that answers. The dev proxy sets `secure: false`, which accepts the certificate.

## Drive

```bash
.claude/skills/verify-vip-edition-flags/verify-edition.sh standard     # mocked 标准版
.claude/skills/verify-vip-edition-flags/verify-edition.sh professional # mocked 专业版
.claude/skills/verify-vip-edition-flags/verify-edition.sh flagship     # mocked 旗舰版
```

Per edition the script logs in (QA account), arms a CDP Fetch interception that fulfills `*corp/org/get-vip-membership*` from `fixtures/<edition>.json` BEFORE the post-login membership fetch, then asserts sidebar enabled/disabled/hover-hint per item, the home-page `name` badge, and 轨迹/位置共享/1分钟 state + hover hints in the edit-member, create-member, and add-device modals. Screenshots and `assertions.log` land in `/tmp/weila-vip-verify/<edition>/` (override with `OUT=`). Exit 0 = every assertion passed. Each edition runs in its own ego-browser TaskSpace, so no page state is shared. The script holds the interception for its whole run, so run editions sequentially rather than concurrently.

## Refreshing fixtures from the real backend

`fixtures/flagship.json` is a real `get-vip-membership` capture from `api.voischat.cn` on 2026-11-25 (旗舰版, `expired` 1787846400, `member_limit` 200, `device_limit` 10000). The standard and professional fixtures are still derived. They carry the spec matrix with limits and dates from the earlier old-contract capture, so their limits may not match what the new endpoint returns for those editions. Re-capture each edition from a corp that holds it when one is available.

To capture, start the dev server with `WEILA_V2_PROXY=<origin>` when you need the LAN backend, run a logged-in page under `Network.enable`, reload, and copy the body of the `get-vip-membership` response the moment its `loadingFinished` lands (`Network.getResponseBody` only works while the document that received it is still loaded):

```js
await page.cdp('Network.enable')
// after ensureLogin(...), reload and pump page.events() in a loop;
// on Network.loadingFinished for a request whose url has get-vip-membership:
const r = await page.cdp('Network.getResponseBody', { requestId })
// r.base64Encoded ? Buffer.from(r.body, "base64") : r.body  → write to fixtures/<edition>.json
```

Do not reconstruct the request by hand. Auth is query-string (`appid/et/sign/uuid/token`, sign = md5 middle-8), and the live capture needs none of it.

## Gotchas

- Arco marks a disabled menu item by CLASS (`arco-menu-disabled`), not `aria-disabled` or the `disabled` attribute. Assert the class.
- Hover hints use the `v-tips` directive: it sets the native `title` attribute on `mouseenter` and clears it on `mouseleave`. Assert by dispatching those events in `eval` and reading `.title`; the a11y snapshot will not show it.
- Wait for the membership response to settle (~3s after login) before asserting menu state. SideBar, the auth store and org.vue share one TanStack query key, and `staleTime: 0` makes them refetch, so expect several requests per session rather than one per page load.
- If the login token is past half-life, the app calls `corp/auth/refresh` before get-vip-membership; that request is NOT mocked and must succeed — a stale session bounces to /login.
- `pages/workbench/realtime-location.vue` fabricates demo pins in DEV when the API list is empty — the page can look alive even when gated; assert the route-guard bounce by URL, not by page content.
- The route guard's redirect warning (Arco Message) auto-dismisses in ~3s; the script asserts the URL bounce only.
- The mock only edits the membership response. Anything asserting limits (member_limit etc. in the corp hover card) must extend the fixture, not the script.
- The two contracts disagree on limits for the same corp. On 2026-11-25 `api.voischat.cn` reported `member_limit` 400 and `device_limit` 100000 on the old endpoint, and 200 and 10000 on the new one. `192.168.1.29` showed the same `member_limit` gap. Do not copy limit values across the two endpoints.
- A token minted by `192.168.1.29` is accepted by `api.voischat.cn` as a session (measured 2026-11-25: `get-selfinfo` answers `45018`, not token invalid). After you switch `WEILA_V2_PROXY`, clear the dev origin's local storage with `Storage.clearDataForOrigin` for that origin only, or the console keeps a session that is not a member on the other backend. Every membership query then fails and the route guard stalls 8s per navigation.
- 终极版 is the backend's wording for 旗舰版; treat them as the same tier. The corp app-management routes (`corp/api/manage/*`) are enabled on 旗舰版 and blocked below it. The QA corp answers 旗舰版 on the wire (2026-11-25), so an unmocked check of those routes runs against it directly; the mocked editions cover the gating itself.

## Cleanup

On success the script disables the interception and finishes its TaskSpace. A failed run leaves its TaskSpace open for debugging and prints its id; close it with `taskSpace(<id>).finish({ keep: [] })`. Stop the dev server you started (background task or `kill %<job>`), never by process name.
