#!/usr/bin/env bash
# verify-edition.sh — prove VIP edition gating in weila-work-web under a mocked
# corp/org/get-my-vip payload, driving the real UI like a user.
#
# Usage: verify-edition.sh <standard|professional|flagship> [base_url]
#   base_url defaults to https://localhost:5174 (pnpm dev:prod from weila-work root).
#
# Preconditions: dev server running; QA account 70009790/123456 valid.
# Evidence lands in $OUT (default /tmp/weila-vip-verify/<edition>/): per-surface
# screenshots + assertions.log + requests.txt. Exit 0 only when every
# assertion passes.
#
# The mock intercepts ONLY get-my-vip; everything else (login, member list,
# self-info) hits the real backend, so the gated UI consumes a real login token
# and real surrounding data.

set -u

EDITION="${1:?usage: verify-edition.sh <standard|professional|flagship> [base_url]}"
BASE="${2:-https://localhost:5174}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FIXTURE="$HERE/fixtures/$EDITION.json"
OUT="${OUT:-/tmp/weila-vip-verify/$EDITION}"
SESS="verify-edition-$EDITION"
AB="agent-browser --session $SESS"

case "$EDITION" in
  standard)
    EDITION_NAME='标准版'
    SIDEBAR_DISABLED='实时位置 轨迹 应用管理'; SIDEBAR_ENABLED='消息'
    EDIT_TRACK=absent; FAST=absent; FAST_TITLE=''
    LOC_DISABLED=true; LOC_TITLE='专业版功能' ;;
  professional)
    EDITION_NAME='专业版'
    SIDEBAR_DISABLED='应用管理'; SIDEBAR_ENABLED='消息 实时位置 轨迹'
    EDIT_TRACK=present; FAST=disabled; FAST_TITLE='旗舰版功能'
    LOC_DISABLED=false; LOC_TITLE='' ;;
  flagship)
    EDITION_NAME='旗舰版'
    SIDEBAR_DISABLED=''; SIDEBAR_ENABLED='消息 实时位置 轨迹 应用管理'
    EDIT_TRACK=present; FAST=enabled; FAST_TITLE='该频率设备耗电大，请慎重'
    LOC_DISABLED=false; LOC_TITLE='' ;;
esac

mkdir -p "$OUT"
LOG="$OUT/assertions.log"
: > "$LOG"

cleanup() {
  $AB network unroute >/dev/null 2>&1
  $AB close >/dev/null 2>&1
}
trap cleanup EXIT

note() { printf '%s\n' "$*" | tee -a "$LOG"; }
failures() { grep -c '^FAIL' "$LOG"; }

$AB open "$BASE/" --ignore-https-errors >/dev/null 2>&1
sleep 8
$AB snapshot -i -c > "$OUT/login-snapshot.txt"
locate_login_refs() {
  USER_REF=$(grep -oE 'textbox "用户名/手机号" \[ref=e[0-9]+\]' "$OUT/login-snapshot.txt" | grep -oE 'e[0-9]+' | head -1)
  PASS_REF=$(grep -oE 'textbox "密码" \[ref=e[0-9]+\]' "$OUT/login-snapshot.txt" | grep -oE 'e[0-9]+' | head -1)
  AGREE_REF=$(grep -oE '我已阅读并同意.*ref=e[0-9]+' "$OUT/login-snapshot.txt" | grep -oE 'e[0-9]+' | tail -1)
}
locate_login_refs
if [ -z "$USER_REF" ] || [ -z "$PASS_REF" ] || [ -z "$AGREE_REF" ]; then
  # first cold module-graph transform can render a blank page; reload once
  $AB open "$BASE/" --ignore-https-errors >/dev/null 2>&1
  sleep 8
  $AB snapshot -i -c > "$OUT/login-snapshot.txt"
  locate_login_refs
fi
if [ -n "$USER_REF" ] && [ -n "$PASS_REF" ] && [ -n "$AGREE_REF" ]; then
  note "PASS login form located ($USER_REF/$PASS_REF/$AGREE_REF)"
else
  note "FAIL login form not located (see $OUT/login-snapshot.txt)"; exit 1
fi

$AB fill "@$USER_REF" "70009790" >/dev/null
$AB fill "@$PASS_REF" "123456" >/dev/null
$AB check "@$AGREE_REF" >/dev/null

# Install the edition mock BEFORE login so the post-login vip fetch is served
# from the fixture (the app queries get-my-vip once the token lands).
if ! $AB network route "**/corp/org/get-my-vip*" --body "$(cat "$FIXTURE")" >/dev/null; then
  note "FAIL network route install failed"; exit 1
fi

$AB find role button click --name "登录" >/dev/null
sleep 6
URL="$($AB get url)"
case "$URL" in
  *'#/contact/org'*|*'#/contact/member'*) note "PASS logged in ($URL)" ;;
  *) note "FAIL login did not land on console ($URL)"; exit 1 ;;
esac

sleep 3  # let the mocked vip response settle before asserting menu state
$AB screenshot "$OUT/sidebar.png" >/dev/null

check_sidebar_item() {  # $1=item text, $2=expected: disabled|enabled
  local ST TT
  ST=$($AB eval "var el=Array.from(document.querySelectorAll('.arco-menu-item')).find(x=>x.textContent.trim()==='$1'); el? (el.className.includes('arco-menu-disabled')?'disabled':'enabled'):'missing'" | tr -d '"')
  if [ "$ST" = "$2" ]; then note "PASS sidebar $1 $2"; else note "FAIL sidebar $1 expected $2, got '$ST'"; fi
  if [ "$2" = "disabled" ]; then
    TT=$($AB eval "var el=Array.from(document.querySelectorAll('.arco-menu-item')).find(x=>x.textContent.trim()==='$1'); if(!el)''; else { el.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); var t=el.title; el.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true})); t }" | tr -d '"')
    if [ -n "$TT" ]; then note "PASS sidebar $1 hover hint '$TT'"; else note "FAIL sidebar $1 has no hover hint"; fi
  fi
}

read -r -a EXP_DISABLED <<< "$SIDEBAR_DISABLED"
read -r -a EXP_ENABLED <<< "$SIDEBAR_ENABLED"
for ITEM in ${EXP_DISABLED[@]+"${EXP_DISABLED[@]}"}; do check_sidebar_item "$ITEM" disabled; done
for ITEM in ${EXP_ENABLED[@]+"${EXP_ENABLED[@]}"}; do check_sidebar_item "$ITEM" enabled; done

VIP=$($AB eval "(document.body.textContent.match(/(标准版|专业版|旗舰版)/)||['none'])[0]" | tr -d '"')
if [ "$VIP" = "$EDITION_NAME" ]; then note "PASS home shows $EDITION_NAME"; else note "FAIL home vip name '$VIP' != '$EDITION_NAME'"; fi

modal_state() {  # $1=hash, $2=trigger text, $3=screenshot name → state JSON on stdout
  $AB open "$BASE/$1" >/dev/null 2>&1
  sleep 4
  $AB find text "$2" click >/dev/null 2>&1
  sleep 2
  $AB screenshot "$OUT/$3.png" >/dev/null 2>&1
  $AB eval "
    var m = Array.from(document.querySelectorAll('.arco-modal')).filter(function(x){return x.offsetParent!==null}).pop();
    if (!m) { JSON.stringify({error:'no visible modal'}) }
    else {
      var labelEls = Array.from(m.querySelectorAll('.arco-form-item-label'));
      var labels = labelEls.map(function(l){return l.textContent.trim()});
      var track = labels.some(function(l){return l.indexOf('轨迹')>=0});
      var fast = Array.from(m.querySelectorAll('label')).find(function(x){return x.textContent.indexOf('1 分钟')>=0});
      var fastState = 'absent';
      var fastTitle = '';
      if (fast) {
        fastState = (fast.hasAttribute('disabled') || fast.querySelector('input[disabled]')) ? 'disabled' : 'enabled';
        fast.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
        fastTitle = fast.title || '';
        fast.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true}));
      }
      var locEl = labelEls.find(function(l){return l.textContent.indexOf('位置共享')>=0});
      var locRow = locEl ? (locEl.closest('.arco-form-item') || locEl.parentElement) : null;
      var locSwitch = locRow ? locRow.querySelector('.arco-switch') : null;
      var locDisabled = locSwitch ? (locSwitch.className.indexOf('disabled')>=0 || !!locSwitch.querySelector('input[disabled]')) : null;
      var locTitle = '';
      if (locSwitch) {
        locSwitch.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));
        locTitle = locSwitch.title || '';
        locSwitch.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true}));
      }
      JSON.stringify({track: track?'present':'absent', fast: fastState, fastTitle: fastTitle, loc: locSwitch?'present':'absent', locDisabled: locDisabled, locTitle: locTitle});
    }"
}

check_modal() {  # $1=state JSON, $2=surface name
  python3 - "$2" "$EDIT_TRACK" "$FAST" "$FAST_TITLE" "$LOC_DISABLED" "$LOC_TITLE" "$1" <<'PYEOF'
import json, sys
name, exp_track, exp_fast, exp_fast_title, exp_loc_dis, exp_loc_title, raw = sys.argv[1:8]
try:
    s = json.loads(raw)
    if isinstance(s, str):
        s = json.loads(s)
except Exception as e:
    print(f"FAIL {name}: unparseable state ({e})"); raise SystemExit
if s.get("error"):
    print(f"FAIL {name}: {s['error']}"); raise SystemExit
def chk(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
chk(s["track"] == exp_track, f"{name} 轨迹 {s['track']} (expect {exp_track})")
chk(s["fast"] == exp_fast, f"{name} 1分钟 {s['fast']} (expect {exp_fast})")
if exp_fast_title:
    chk(exp_fast_title in s["fastTitle"], f"{name} 1分钟 hover '{s['fastTitle']}'")
chk(s["loc"] == "present", f"{name} 位置共享 present")
chk(str(s["locDisabled"]).lower() == exp_loc_dis.lower(), f"{name} 位置共享 disabled={s['locDisabled']} (expect {exp_loc_dis})")
if exp_loc_title:
    chk(exp_loc_title in s["locTitle"], f"{name} 位置共享 hover '{s['locTitle']}'")
else:
    chk(s["locTitle"] == "", f"{name} 位置共享 no hover hint when enabled")
PYEOF
}

close_visible_modals() {
  $AB eval "Array.from(document.querySelectorAll('.arco-modal .arco-modal-close-btn')).filter(function(b){return b.offsetParent!==null}).forEach(function(b){b.click()}); 'x'" >/dev/null
  sleep 1
}

ST=$(modal_state "#/contact/member" "编辑" "edit-member-modal")
check_modal "$ST" "edit-member" | tee -a "$LOG"
close_visible_modals

ST=$(modal_state "#/contact/member" "创建成员" "create-member-modal")
check_modal "$ST" "create-member" | tee -a "$LOG"
close_visible_modals

ST=$(modal_state "#/contact/member" "新增设备" "add-device-modal")
check_modal "$ST" "add-device" | tee -a "$LOG"

# blocked = navigation bounces off the gated route; allowed = it stays.
check_route_guard() {  # $1=hash fragment, $2=blocked|allowed
  local U OK
  $AB open "$BASE/$1" >/dev/null 2>&1
  sleep 4
  U=$($AB get url | tr -d '"')
  case "$U" in
    *"$1"*) OK=$([ "$2" = "allowed" ] && echo yes || echo no) ;;
    *)      OK=$([ "$2" = "blocked" ] && echo yes || echo no) ;;
  esac
  if [ "$OK" = "yes" ]; then note "PASS route-guard $1 $2"; else note "FAIL route-guard $1 expected $2, landed $U"; fi
}

case "$EDITION" in
  standard)
    check_route_guard "#/workbench/realtime-location" blocked
    check_route_guard "#/workbench/user-track" blocked
    check_route_guard "#/workbench/message" allowed
    check_route_guard "#/workbench/application" blocked ;;
  professional)
    check_route_guard "#/workbench/realtime-location" allowed
    check_route_guard "#/workbench/user-track" allowed
    check_route_guard "#/workbench/message" allowed
    check_route_guard "#/workbench/application" blocked ;;
  flagship)
    check_route_guard "#/workbench/realtime-location" allowed
    check_route_guard "#/workbench/user-track" allowed
    check_route_guard "#/workbench/message" allowed
    check_route_guard "#/workbench/application" allowed ;;
esac

$AB network requests --filter get-my-vip > "$OUT/requests.txt" 2>&1
note "EVIDENCE get-my-vip request lines captured in $OUT/requests.txt"

RC=$(failures)
note "RESULT $EDITION failures=$RC"
[ "$RC" -eq 0 ]
