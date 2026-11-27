#!/usr/bin/env bash
# verify-pool.sh — prove the 106 LAN account pool logs in and renders the vip
# tier each org claims, driving the real UI through ego-browser.
#
# Usage: verify-pool.sh [base_url]
#   base_url defaults to https://localhost:5194.
#
# Preconditions: dev server started against the 106 backend; WEILA_POOL_PASSWORD
# set (lives in ~/.voischat/env.sh). Evidence lands in $OUT (default
# /tmp/weila-account-pool/): one screenshot per tier + assertions.log + run.log.
# Exit 0 only when every assertion passes.

set -euo pipefail

BASE="${1:-https://localhost:5173}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT:-/tmp/weila-account-pool}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

command -v ego-browser >/dev/null || { echo "FAIL ego-browser not found (see the ego-browser skill's install reference)" >&2; exit 2; }
[ -n "${WEILA_POOL_PASSWORD:-}" ] || { echo "FAIL WEILA_POOL_PASSWORD not set (it lives in ~/.voischat/env.sh)" >&2; exit 2; }

# The embedded ego-browser Node runtime parses stdin as JavaScript and has no
# shell cwd or environment, so the prelude stays JS: it sets the CFG global and
# imports the typed entry. node -e escapes the strings instead of hand-rolling
# JSON quoting.
CFG=$(node -e '
const [base, outDir, password, poolJson, scriptPath] = process.argv.slice(1)
process.stdout.write(JSON.stringify({ base, outDir, password, poolJson, scriptPath }))
' "$BASE" "$OUT" "$WEILA_POOL_PASSWORD" "${WEILA_POOL_JSON:-}" "$HERE/verify-pool.ts")

# The ego runtime prints script output on stderr, so merge streams before tee.
{ printf 'globalThis.CFG = %s;\nawait import(globalThis.CFG.scriptPath);\n' "$CFG"; } | ego-browser nodejs 2>&1 | tee "$OUT/run.log"

if grep -q '^FAIL' "$OUT/assertions.log" || ! grep -q 'RESULT .* failures=0' "$OUT/assertions.log"; then
  exit 1
fi
