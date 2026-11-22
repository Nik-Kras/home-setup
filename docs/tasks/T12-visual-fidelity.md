# T12: make the app look exactly like the design (user feedback, high priority)

Implementer: Opus 5.5 in worktree `../home-setup-wt-t12` (branch `t12`). YOU may use the Android emulator (emulator-5554; you are the only user of it). Another agent (T11) changes item/task behaviour in parallel: do not change behaviour, only appearance.

## What the user said
"The app is terrible. It does not look like the design in the artifact. The icons are not colourful. The icons use different pictures." Make the built app look EXACTLY like the design images.

## Source of truth
Private design images in /Users/nikitakrasnytskyi/Repos/home-setup/design-ref/screens/ (Main, Add, AddTask, Budget, FlatNotes, Home, Item, TaskDetail, TaskGroup, TaskShared, Tasks, TasksDaryna, WidgetsAndroid, TaskWidgets) and the HTML sources in design-ref/source/*.dc.html (read them for exact sizes, radii, colours, glyph paths). Tokens: app/src/theme/tokens.ts. Decisions: docs/design-decisions.md (note: the earlier decision for neutral item tiles is OVERRIDDEN by the user's explicit feedback: the design's coloured category tiles win; keep coral only for urgent, mint for done/primary, lilac for Daryna, amber for in-transit).

## Do, in a loop until it matches
1. Build the dev or release app, run on the emulator (see CLAUDE.md; app/e2e/README.md for how to sign in as the Claude test account; real data is already in the shared database). Screenshot each screen at 1080x2400 into /private/tmp/claude-501/-Users-nikitakrasnytskyi-Repos/79636bc3-97e1-4783-ae4c-c06353b1bb30/scratchpad/pass8/<screen>-<iteration>.png and compare against the matching design image.
2. Fix: category-coloured glyph tiles on every item row (kitchen amber tint, living room green, bedroom lilac, bathroom/hallway per the design), the SAME glyph set the design uses for each item/category (pick a glyph by item name keywords and fall back to the room), consistent stroke width and size, owner dots, price and urgent text, status chip colours, spacing, font sizes, the Next-up card, tab bar, headers, task rows and group headers, notes, budget bars, item detail, add sheets, empty states.
3. After each iteration run the layout checker (design-ref/check.py if usable) and review screenshots yourself against the design; list remaining differences; repeat. Stop when differences are only data (names, dates) or at most 5 iterations, then report remaining gaps honestly.
4. Keep npm test and npx tsc --noEmit green. Do not touch behaviour, stores or queue code.

## Acceptance
Commit on t12 "T12: visual fidelity to the design", trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"; do not push or merge. Report max 200 words: screens compared, differences fixed, remaining differences, screenshot folder path.
