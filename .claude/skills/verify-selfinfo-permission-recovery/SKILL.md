---
name: verify-selfinfo-permission-recovery
description: Regression check for Weila Work web owner-gated UI after a failed token refresh and SPA re-login. Drives the real console with ego-browser and asserts the 部门管理员 switch in the member edit dialog stays enabled and the self-info query refetches. Use after changes to stores/selfInfo.ts, stores/auth.ts, composables/useWeilaFetch.ts, or EditMemberModal.vue.
---

# Verify self-info permission recovery

The self-info query lives in a singleton Pinia store. If its first fetch fails, nothing refetches it, and an owner keeps the non-owner permission state. Owner-only controls such as the 部门管理员 switch in the member edit dialog then stay disabled until a full page reload. A failed token refresh followed by an SPA re-login is the reproducible trigger.

## Launch

Run the Launch and Doctor sections of `../verify-weila-work-web/SKILL.md`. Use the `Local:` URL from the dev server log as `BASE`. Do not assume port 5173.

## Drive

```bash
.claude/skills/verify-selfinfo-permission-recovery/scripts/check.sh --base "$BASE"
```

The script runs one ego-browser TaskSpace. It logs in, opens the edit dialog for a member that exposes the switch, asserts the switch is enabled, expires the session (`login_time=0` plus an invalid refresh token), reloads, logs in again without a page reload, then asserts the switch is enabled and a token-bearing `get-selfinfo` request follows the login. A backend-rejected session can bounce back to `#/login` after the form submits; the script detects the bounce and logs in again. It exits nonzero on failure.

Override `--account`, `--password`, or `--evidence-dir` only when the defaults do not fit. The default account is the QA owner `70009790` with password `123456`. `--session` is accepted for old callers and ignored.

## Evidence

The script writes to `$CLAUDE_JOB_DIR/tmp/selfinfo-verify` by default.

- `before-relogin.png` and `after-relogin.png` show the switch before and after the re-login.
- `get-selfinfo.json` holds the request log with auth query values scrubbed. A passing run contains a request with `token=` after the login marker.
- `assertions.log` and `run.log` hold the PASS/FAIL lines the exit code is derived from.

A passing proof is the five PASS lines and exit code 0. A disabled switch after re-login is the regression, even when the baseline passes. To check the non-owner gate, mock `get-selfinfo` with `type: 0` and confirm the switch renders disabled.

## Cleanup

A passing run finishes its own TaskSpace. A failed run leaves it open for debugging and prints its id; close it with `taskSpace(<id>).finish({ keep: [] })`. Stop the dev server you started.

## Known gap

The script proves recovery when the token is cleared and set again. A `get-selfinfo` failure with an unchanged, still-valid token is not retried automatically, so the switch can stay disabled until the next reload or auth change.
