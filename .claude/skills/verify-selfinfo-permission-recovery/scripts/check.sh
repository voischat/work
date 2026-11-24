#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check.sh --base <url> [--session <ignored>] [--account <id>] [--password <pw>] [--evidence-dir <dir>]

Drives the owner path through a failed token refresh, an SPA re-login, and the
member edit dialog. Fails unless the 部门管理员 switch is enabled after re-login
and a token-bearing get-selfinfo request follows the login.
EOF
}

BASE=""
ACCOUNT="${WEILA_QA_ACCOUNT:?set WEILA_QA_ACCOUNT to the QA account}"
PASSWORD="${WEILA_QA_PASSWORD:?set WEILA_QA_PASSWORD to the QA password}"
EVIDENCE_DIR="${CLAUDE_JOB_DIR:-$PWD}/tmp/selfinfo-verify"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base) BASE="$2"; shift 2 ;;
    --session) shift 2 ;;  # kept for old callers; each run now gets its own TaskSpace
    --account) ACCOUNT="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --evidence-dir) EVIDENCE_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$BASE" ]] || { echo "FAIL --base is required" >&2; exit 2; }
command -v ego-browser >/dev/null || { echo "FAIL ego-browser not found (see the ego-browser skill's install reference)" >&2; exit 2; }

mkdir -p "$EVIDENCE_DIR"
EVIDENCE_DIR="$(cd "$EVIDENCE_DIR" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"

# The embedded ego-browser Node runtime has no shell cwd or env, so every path
# rides in through the CFG prelude and the script imports the driver by
# absolute path.
CFG=$(printf '{ "base": "%s", "account": "%s", "password": "%s", "evidenceDir": "%s", "libPath": "%s" }' \
  "$BASE" "$ACCOUNT" "$PASSWORD" "$EVIDENCE_DIR" "$HERE/../../lib/ego-driver.mjs")

# The ego runtime prints script output on stderr, so merge streams before tee.
{ printf 'const CFG = %s;\n' "$CFG"; cat "$HERE/check.mjs"; } | ego-browser nodejs 2>&1 | tee "$EVIDENCE_DIR/run.log"

if grep -q '^FAIL' "$EVIDENCE_DIR/assertions.log" || ! grep -q 'RESULT .* failures=0' "$EVIDENCE_DIR/assertions.log"; then
  exit 1
fi
