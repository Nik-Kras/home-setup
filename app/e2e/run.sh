#!/bin/bash
# Runs the Maestro e2e flows against the dev build on the Android emulator.
#
#   e2e/run.sh            all flows in e2e/flows, in order
#   e2e/run.sh 03 05      only flows whose file name starts with 03 or 05
#
# Prints PASS/FAIL per flow and exits non-zero if any flow failed. Reads the Claude account and Supabase
# keys from app/.env and passes them to Maestro with -e; they are never printed. Maestro's own logs record
# typed text, so they go to a temp folder that is deleted after each flow (screenshots of a failed flow
# are kept in e2e/.out/, which git ignores). Test rows are named "ZZ-e2e-..." and every "ZZ..." row is
# soft-deleted before and after the run (KEEP_DATA=1 skips the cleanup at the end).
set -uo pipefail
E2E="$(cd "$(dirname "$0")" && pwd)"
APP="$(dirname "$E2E")"
cd "$APP"
. "$E2E/env.sh"

[ -f .env ] || { echo "app/.env is missing"; exit 2; }
set -a; . ./.env; set +a
for v in EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY CLAUDE_EMAIL CLAUDE_PASSWORD; do
  [ -n "${!v:-}" ] || { echo "app/.env has no $v"; exit 2; }
done
command -v maestro >/dev/null || { echo "maestro is not installed"; exit 2; }
adb -s "$DEVICE" get-state >/dev/null 2>&1 || { echo "device $DEVICE is not connected"; exit 2; }

# Metro: use the running server, or start one for this run.
METRO_PID=""
if ! curl -s localhost:8081/status | grep -q running; then
  echo "starting Metro..."
  npx expo start --port 8081 >"$E2E/.metro.log" 2>&1 &
  METRO_PID=$!
  for _ in $(seq 1 60); do curl -s localhost:8081/status | grep -q running && break; sleep 2; done
fi
adb -s "$DEVICE" reverse tcp:8081 tcp:8081 >/dev/null

TMP="$(mktemp -d)"
cleanup() {
  adb -s "$DEVICE" shell cmd connectivity airplane-mode disable >/dev/null 2>&1
  rm -rf "$TMP"
  [ -n "$METRO_PID" ] && kill "$METRO_PID" 2>/dev/null
}
trap cleanup EXIT

db() { npx -y tsx "$E2E/db.mts" "$@"; }

# Pick flows.
FLOWS=()
for f in "$E2E"/flows/*.yaml; do
  name="$(basename "$f")"
  if [ $# -eq 0 ]; then FLOWS+=("$f"); continue; fi
  for want in "$@"; do [[ "$name" == "$want"* ]] && FLOWS+=("$f"); done
done
[ ${#FLOWS[@]} -gt 0 ] || { echo "no flows match: $*"; exit 2; }

echo "cleanup before: $(db cleanup)"

# Setup used by some flows.
for f in "${FLOWS[@]}"; do
  case "$(basename "$f")" in
    06-*)
      adb -s "$DEVICE" shell 'rm -f /sdcard/Pictures/zz-e2e-photo-*.jpg' >/dev/null
      adb -s "$DEVICE" push "$E2E/assets/zz-e2e-photo.jpg" "/sdcard/Pictures/zz-e2e-photo-$(date +%s).jpg" >/dev/null
      adb -s "$DEVICE" shell content call --method scan_volume --uri content://media --arg external_primary >/dev/null ;;
    08-*|08b-*)
      [ -n "${WIDGET_DONE:-}" ] || { "$E2E/place-widget.sh" || echo "place-widget failed; the widget flows will fail"; WIDGET_DONE=1; } ;;
  esac
done

PASSED=0; FAILED=0; RESULTS=()
for f in "${FLOWS[@]}"; do
  name="$(basename "$f" .yaml)"
  out="$TMP/$name"; mkdir -p "$out"
  start=$(date +%s)
  maestro --device "$DEVICE" test \
    --debug-output "$out/debug" --test-output-dir "$out/test" \
    -e SB_URL="$EXPO_PUBLIC_SUPABASE_URL" -e SB_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
    -e E2E_EMAIL="$CLAUDE_EMAIL" -e E2E_PASSWORD="$CLAUDE_PASSWORD" \
    "$f" >"$out/console.txt" 2>&1
  code=$?
  secs=$(( $(date +%s) - start ))
  # Timing lines written by flows with console.log('E2E-TIMING ...').
  grep -rhoE "E2E-TIMING [^\"']*[0-9]+ ms[^\"']*" "$out" 2>/dev/null | sort -u | sed 's/^/      /'
  adb -s "$DEVICE" shell cmd connectivity airplane-mode disable >/dev/null 2>&1
  if [ $code -eq 0 ]; then
    PASSED=$((PASSED + 1)); RESULTS+=("PASS  $name  (${secs}s)"); echo "PASS  $name  (${secs}s)"
  else
    FAILED=$((FAILED + 1)); RESULTS+=("FAIL  $name  (${secs}s)"); echo "FAIL  $name  (${secs}s)"
    # The failing step and its message (Maestro's console never shows the typed credentials).
    clean="$(grep -vE '^\s+at |^\s*$|│|╭|╰|SKIPPED' "$out/console.txt")"
    if grep -q 'FAILED\|Exception' <<<"$clean"; then
      grep -B2 -A6 -m1 'FAILED\|Exception' <<<"$clean" | sed 's/^/      /' | cut -c1-240
    else
      tail -8 <<<"$clean" | sed 's/^/      /' | cut -c1-240   # e.g. a flow that does not parse
    fi
    mkdir -p "$E2E/.out/$name"; rm -f "$E2E/.out/$name"/*.png
    find "$out" -name '*.png' -exec cp {} "$E2E/.out/$name/" \; 2>/dev/null
    echo "      screenshots: e2e/.out/$name/"
  fi
done

if [ -z "${KEEP_DATA:-}" ]; then echo "cleanup after: $(db cleanup)"; fi
echo
printf '%s\n' "${RESULTS[@]}"
echo "$PASSED passed, $FAILED failed"
[ $FAILED -eq 0 ]
