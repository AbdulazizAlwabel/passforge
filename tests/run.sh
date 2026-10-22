#!/usr/bin/env bash
# Runs the browser test suites against a local copy of the site (fake database + email, see harness.js).
#   bash tests/run.sh               # everything
#   bash tests/run.sh pdf-e2e acct  # selected suites
# Results: a summary at the end; logs, downloads and screenshots in tests/.work/
set -uo pipefail
T="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$T/.." && pwd)"; W="$T/.work"
export F="$W/fixtures" DL="$W/downloads" OUT="$W/shots"; mkdir -p "$F" "$DL" "$OUT" "$W/logs"
command -v magick >/dev/null 2>&1 || export PATH="$T/bin:$PATH"
ALL="e2e ar owner features features-ar acct acct-ar pdf-e2e pdf-touch pdf-ar pdf-site pdf-offline pdf2-sign pdf2-vault-touch pdf2-ar pdf3-tools pdf3-ar phone-widths"
SUITES="${*:-$ALL}"
HP=""
stop() { if [ -n "$HP" ]; then kill "$HP" 2>/dev/null; wait "$HP" 2>/dev/null; HP=""; fi; }
start() {
  stop; node "$T/harness.js" > "$W/logs/server.log" 2>&1 & HP=$!
  for _ in $(seq 1 80); do curl -s -o /dev/null http://localhost:8899/ && return 0; sleep 0.25; done
  echo "test server did not start:"; tail -20 "$W/logs/server.log"; exit 1
}
trap stop EXIT
node -e "if(!require('$T/chrome.js')){console.error('No Chromium found — run tests/setup.sh');process.exit(1)}" || exit 1
echo "▸ building the site"; (cd "$R" && python3 build.py) > "$W/logs/build.log" 2>&1 || { cat "$W/logs/build.log"; exit 1; }
if [ ! -f "$F/.done" ]; then echo "▸ making test files"; start; bash "$T/fixtures/make.sh" "$F" > "$W/logs/fixtures.log" 2>&1 || { tail -30 "$W/logs/fixtures.log"; exit 1; }; touch "$F/.done"; fi
pass=0; failed=()
for s in $SUITES; do
  start; t0=$(date +%s)
  out=$(cd "$T/e2e" && timeout 900 node "$s.js" 2>&1); echo "$out" > "$W/logs/$s.log"
  verdict=$(echo "$out" | grep -E "ALL PASSED|FAILED|pages fit|pages overflow" | tail -1)
  if echo "$verdict" | grep -qE "ALL PASSED|pages fit"; then pass=$((pass+1)); printf "  ✓ %-18s %ss  %s\n" "$s" "$(( $(date +%s)-t0 ))" "$verdict"
  else failed+=("$s"); printf "  ✗ %-18s %s\n" "$s" "${verdict:-crashed}"; echo "$out" | grep -E "^FAIL|Error|OVERFLOW" | head -6 | sed 's/^/      /'; fi
done
stop
echo; echo "$pass passed, ${#failed[@]} failed${failed:+: ${failed[*]}}  (logs in tests/.work/logs)"
[ ${#failed[@]} -eq 0 ]
