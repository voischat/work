#!/usr/bin/env bash
# verify-edition.sh — prove VIP edition gating in weila-work-web under a mocked
# corp/org/get-vip-membership payload, driving the real UI like a user via ego-browser.
#
# Usage: verify-edition.sh <standard|professional|flagship> [base_url]
#   base_url defaults to https://localhost:5174 (pnpm dev:prod from weila-work root).
#
# Preconditions: dev server running; WEILA_QA_ACCOUNT/WEILA_QA_PASSWORD set.
# Evidence lands in $OUT (default /tmp/weila-vip-verify/<edition>/): per-surface
# screenshots + assertions.log + requests.txt + run.log. Exit 0 only when every
# assertion passes.
#
# The mock intercepts ONLY get-vip-membership; everything else (login, member list,
# self-info) hits the real backend, so the gated UI consumes a real login token
# and real surrounding data.

set -euo pipefail

EDITION="${1:?usage: verify-edition.sh <standard|professional|flagship> [base_url]}"
BASE="${2:-https://localhost:5174}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FIXTURE="$HERE/fixtures/$EDITION.json"
OUT="${OUT:-/tmp/weila-vip-verify/$EDITION}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

command -v ego-browser >/dev/null || { echo "FAIL ego-browser not found (see the ego-browser skill's install reference)" >&2; exit 2; }
[ -f "$FIXTURE" ] || { echo "FAIL fixture missing: $FIXTURE" >&2; exit 2; }

# The embedded ego-browser Node runtime parses stdin as JavaScript and has no
# shell cwd or environment, so the prelude stays JS: it sets the CFG global and
# imports the typed entry. node -e escapes the strings instead of hand-rolling
# JSON quoting.
CFG=$(node -e '
const [edition, base, outDir, fixturePath, account, password, scriptPath] = process.argv.slice(1)
process.stdout.write(JSON.stringify({ edition, base, outDir, fixturePath, account, password, scriptPath }))
' "$EDITION" "$BASE" "$OUT" "$FIXTURE" "${WEILA_QA_ACCOUNT:?}" "${WEILA_QA_PASSWORD:?}" "$HERE/verify-edition.ts")

# The ego runtime prints script output on stderr, so merge streams before tee.
{ printf 'globalThis.CFG = %s;\nawait import(globalThis.CFG.scriptPath);\n' "$CFG"; } | ego-browser nodejs 2>&1 | tee "$OUT/run.log"

if grep -q '^FAIL' "$OUT/assertions.log" || ! grep -q 'RESULT .* failures=0' "$OUT/assertions.log"; then
  exit 1
fi
