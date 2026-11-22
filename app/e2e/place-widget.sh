#!/bin/bash
# Places the "Our flat · large" widget on the emulator home screen (Pixel launcher), unless an Our flat
# widget is already there. Use --force to add another one. Best effort: it long-presses an empty spot
# just above the dock, opens the widget picker with Maestro, then drags the widget with adb.
set -euo pipefail
cd "$(dirname "$0")"
. ./env.sh

bound() { adb -s "$DEVICE" shell dumpsys appwidget | sed -n '/^Widgets:/,$p' | grep -c "cmp:ComponentInfo{app.homesetup.household/" || true; }

before=$(bound)
if [ "$before" -gt 0 ] && [ "${1:-}" != "--force" ]; then
  echo "place-widget: an Our flat widget is already on the home screen ($before bound)"
  exit 0
fi

maestro --device "$DEVICE" test widget/open-picker.yaml >/dev/null
# Centre of the "Our flat · large" preview cell, read from the screen.
read -r x y < <(maestro --device "$DEVICE" hierarchy --compact 2>/dev/null \
  | grep 'accessibilityText=Our flat · large widget' | head -1 \
  | sed -E 's/.*bounds=\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\].*/\1 \2 \3 \4/' \
  | awk '{ print int(($1+$3)/2), int(($2+$4)/2) }')
[ -n "${x:-}" ] || { echo "place-widget: widget preview not found"; exit 1; }
adb -s "$DEVICE" shell input draganddrop "$x" "$y" 540 1000 2500
sleep 3
adb -s "$DEVICE" shell input keyevent KEYCODE_HOME

after=$(bound)
if [ "$after" -gt "$before" ]; then echo "place-widget: widget placed ($after bound)"; else echo "place-widget: widget was not placed"; exit 1; fi
