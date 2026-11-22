# End-to-end tests (Maestro)

Flows that drive the dev build on the Android emulator and check the Supabase database as the Claude account.

## Run

From `app/`:

```
e2e/run.sh            # all flows, in order
e2e/run.sh 03 05      # only flows whose file name starts with 03 or 05
KEEP_DATA=1 e2e/run.sh 06   # leave the test rows in place afterwards
```

It prints `PASS` or `FAIL` per flow (with the failing step) and exits non-zero if any flow failed. A full run takes about 15 minutes.

Needs:
- Maestro 2.x, JDK 17 and the Android platform tools (paths in `env.sh`; `DEVICE` defaults to `emulator-5554`).
- The dev build (`app.homesetup.household`) installed on the emulator. Metro is used if it is running on port 8081, otherwise `run.sh` starts it. `run.sh` sets up `adb reverse`.
- `app/.env` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `CLAUDE_EMAIL`, `CLAUDE_PASSWORD`. These are passed to Maestro with `-e` and never written in a flow or printed. Maestro's own debug logs do record typed text, so `run.sh` writes them to a temp folder and deletes it after each flow. Screenshots of a failed flow are kept in `e2e/.out/` (git-ignored).

## Flows

| Flow | Checks |
|---|---|
| 01 auth | wrong password shows an error; sign-in works; the session survives a cold restart; clearing the app's data signs out |
| 02 add item | type, submit, the row shows within 5 s of submit; one row in the database |
| 03 item lifecycle | Needed → Looking → Ordered → Delivered from the detail screen; database checked at each step |
| 04 offline queue | airplane mode on, add and edit (status, urgent), nothing reaches the database; reconnect: the changes land once, no duplicate rows on screen or in the database, also after a restart |
| 05 tasks | own task (tick), the other person's task (cannot tick), shared task: my tick changes only my part; the other person's tick (through the database) completes it on the open screen |
| 06 photos | pick the pushed image in Android's photo picker, it uploads (`item_photos` row under `items/`), shows on the item, and on Home once delivered |
| 07 flat notes | create (kind "To confirm"), edit details, still there after a cold restart |
| 08 widget | app not running: the widget's circle marks an item got (database checked); `+` opens the app on the focused add field |
| 08b widget, app in background | the same got tap while the app is alive in the background |
| 09 deep links | `homesetup://item/<id>` warm, cold and signed out (sign in, then the item opens); `homesetup://add-item` |
| 10 live sync | another device (REST API as Claude) adds, marks urgent, renames and delivers an item; the open app follows without a tap |

Signed in as the Claude account the app acts as Nikita (`me` defaults to Nikita for a non-person account), so "Mine" is Nikita's list and Daryna's part of a shared task is ticked through the database.

## Files

- `flows/*.yaml`: the flows; `flows/common/`: shared steps (open the dev build, sign in, add an item or task, database check).
- `scripts/db.js`: database checks inside a flow (Maestro's JavaScript: `http`, polling, throws on failure). Ops: `expect-item`, `expect-count`, `expect-task`, `expect-note`, `expect-photo-row`, `get-id`, `add-item`, `set-item`, `set-assignment`.
- `db.mts`: the same from the shell (`npx -y tsx e2e/db.mts list|cleanup|item|expect-...|set-...`). `run.sh` uses it to clean up.
- `place-widget.sh`: puts a large Our flat widget on the home screen if none is there (Pixel launcher: opens the widget picker with `widget/open-picker.yaml`, then drags with `adb shell input draganddrop`; `--force` adds another).
- `assets/zz-e2e-photo.jpg`: the image `run.sh` pushes to the emulator gallery for flow 06.

## Data rules

- Live data is changed only as the Claude account. Test rows are named `ZZ-e2e-...`; `db.js` refuses to write anything else.
- Cleanup is soft delete only (sets `deleted_at` on items, tasks and flat notes whose name or title starts with `ZZ`), before and after every run. Claude cannot hard-delete.
- Photo files uploaded by flow 06 stay in the `photos` bucket (only the two people can delete storage objects); their item is soft-deleted.

## Known failures (2026-11-22, dev build)

- **Widget "got" tap is sometimes lost** (flows 08 and 08b, about half of the runs, with the app closed or in the background). The widget shows the item, the tap lands, but the item stays "needed" in the database and nothing is queued; reopening the app does not send it. A tap made a minute after the app was closed worked every time it was tried by hand. Logcat shows the widget worker starting; in the dev build the headless JS also logs "Cannot connect to Expo CLI" (10.0.2.2:8081), so this needs checking on a release build before it is called an app bug.
- A widget placed while the app is not running stays on the grey placeholder until the app next opens and redraws (seen once with `place-widget.sh --force`). `goto-widget` therefore looks for the row it needs, not the first widget.

## Limits

- The app has no sign-out button yet (M4), so flow 01 signs out by clearing the app's data (`clearState`).
- Widget placement is outside the app and Maestro cannot long-press-and-drag, hence `place-widget.sh`; it depends on the Pixel launcher layout and an empty spot just above the dock.
- `hideKeyboard` presses Back on Android (it can leave the app or close a sheet), so the flows avoid it after typing in the app.
- The dev build shows a LogBox toast at the bottom of the screen for warnings; flows scroll controls to the middle before tapping them.
- Timing: Maestro adds about 5 s of its own to tap and type, so flow 02 checks submit-to-row under 5 s and the whole sequence under 15 s.
