#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check.sh --base <url> [--session <name>] [--account <id>] [--password <pw>] [--evidence-dir <dir>]

Drives the owner path through a failed token refresh, an SPA re-login, and the
member edit dialog. Fails unless the 部门管理员 switch is enabled after re-login
and a token-bearing get-selfinfo request follows the login.
EOF
}

BASE=""
SESSION="selfinfo-verify"
ACCOUNT="70009790"
PASSWORD="123456"
EVIDENCE_DIR="${CLAUDE_JOB_DIR:-$PWD}/tmp/selfinfo-verify"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --session) SESSION="$2"; shift 2 ;;
    --account) ACCOUNT="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --evidence-dir) EVIDENCE_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$BASE" ]] || { echo "FAIL --base is required" >&2; exit 2; }
command -v agent-browser >/dev/null || { echo "FAIL agent-browser not found" >&2; exit 2; }

mkdir -p "$EVIDENCE_DIR"

ab() { agent-browser --session "$SESSION" "$@"; }
fail() { echo "FAIL $*" >&2; exit 1; }
pass() { echo "PASS $*"; }

wait_for_url() {
  local pattern="$1" seconds="$2" i
  for ((i = 0; i < seconds; i++)); do
    [[ "$(ab get url 2>/dev/null || true)" == *"$pattern"* ]] && return 0
    sleep 1
  done
  return 1
}

login_if_needed() {
  local url
  url=$(ab get url 2>/dev/null || true)
  [[ "$url" == *"#/login"* ]] || return 0
  ab find placeholder "用户名/手机号" fill "$ACCOUNT" >/dev/null
  ab find placeholder "密码" fill "$PASSWORD" >/dev/null
  ab find text "我已阅读并同意" click >/dev/null
  ab find role button click --name "登录" >/dev/null
  wait_for_url "#/contact/org" 15 || fail "login did not reach #/contact/org"
  pass "logged in as $ACCOUNT"
}

switch_state() {
  ab eval "(() => { const label = [...document.querySelectorAll('.arco-form-item-label')].find(el => el.textContent.trim() === '部门管理员'); const item = label?.closest('.arco-form-item'); const sw = item?.querySelector('button.arco-switch'); return sw ? (sw.disabled ? 'disabled' : 'enabled') : 'missing'; })()" 2>/dev/null | tr -d '"'
}

open_switch_modal() {
  local i ref refs state
  ab eval "location.hash='#/contact/member'" >/dev/null
  refs=""
  for ((i = 0; i < 15; i++)); do
    refs=$(ab snapshot -i -c 2>/dev/null | grep -oE 'button "编辑" \[ref=e[0-9]+\]' | grep -oE 'e[0-9]+' | head -8)
    [[ -n "$refs" ]] && break
    sleep 1
  done
  [[ -n "$refs" ]] || fail "member list did not render an 编辑 button"

  for ref in $refs; do
    ab click "@$ref" >/dev/null
    sleep 1
    state=$(switch_state)
    if [[ "$state" != "missing" ]]; then
      echo "$state"
      return 0
    fi
    ab press Escape >/dev/null
    sleep 1
  done
  fail "no member edit dialog exposed the 部门管理员 switch"
}

token_fetches_after() {
  local marker="$1"
  ab network requests --filter "get-selfinfo" --json 2>/dev/null | python3 -c '
import json, sys
marker = float(sys.argv[1])
reqs = json.load(sys.stdin).get("data", {}).get("requests", [])
after = [r for r in reqs if float(r.get("timestamp", 0)) > marker]
print(sum(1 for r in after if "token=" in r.get("url", "")))
' "$marker"
}

ab open "$BASE/" --ignore-https-errors >/dev/null 2>&1
sleep 8
login_if_needed

baseline=$(open_switch_modal)
[[ "$baseline" == "enabled" ]] || fail "baseline: 部门管理员 switch is $baseline"
ab screenshot "$EVIDENCE_DIR/before-relogin.png" >/dev/null
pass "baseline: 部门管理员 switch enabled"
ab press Escape >/dev/null
sleep 1

marker=$(python3 -c 'import time; print(int(time.time() * 1000))')
ab eval "localStorage.setItem('login_time','0'); localStorage.setItem('refresh_token','invalid-refresh-token-for-repro'); location.reload()" >/dev/null
wait_for_url "#/login" 20 || fail "expired session did not redirect to #/login"
pass "expired session redirected to #/login"

login_if_needed

after=$(open_switch_modal)
[[ "$after" == "enabled" ]] || fail "after re-login: 部门管理员 switch is $after"
ab screenshot "$EVIDENCE_DIR/after-relogin.png" >/dev/null

count=0
for ((i = 0; i < 20; i++)); do
  count=$(token_fetches_after "$marker")
  ((count > 0)) && break
  sleep 1
done
((count > 0)) || fail "no token-bearing get-selfinfo request after re-login"
ab network requests --filter "get-selfinfo" --json >"$EVIDENCE_DIR/get-selfinfo.json" 2>/dev/null

pass "after re-login: 部门管理员 switch enabled"
pass "self-info refetched after re-login ($count request(s))"
pass "evidence in $EVIDENCE_DIR; session $SESSION left open"
ab press Escape >/dev/null || true
