# T07b: iOS widgets (M6)

Implementer: Codex (Sol 6.2, effort high) via /codex:rescue in worktree `../home-setup-wt-t07b` (branch `t07b`, changes left uncommitted; the orchestrator commits). Reviewer: Fable 5.2. The widgets cannot be viewed on this Mac (no Xcode); verification is config, typecheck, export and prebuild output only.

## Goal
Small, medium and large iPhone home-screen widgets that mirror the Android ones, using Expo's `expo-widgets` (check https://docs.expo.dev/llms.txt and the SDK 58 docs for the current API before coding; if `expo-widgets` is unsuitable, say why and propose the alternative, do not silently switch).

## Do
1. Reuse the data contract in `app/src/domain/widgetData.ts` and the snapshot in `app/src/data/widgetSnapshot.ts`; share the data with the widget extension through an App Group (identifier `group.app.homesetup.household`).
2. Widgets: small = count left and add button; medium = header and top 3 rows; large = rooms and 4 rows. Look: dark surface `#171B19`, serif numbers, mint accent `#5EE0B8`, neutral chips, coral "!" for urgent, text 13pt minimum. Design reference: `design-ref/screens/WidgetsiOS.png` if present, else WidgetsAndroid.png (read from the main checkout path in docs/tasks/README.md).
3. Taps: plus opens `homesetup://add-item`, a row opens `homesetup://item/<id>`, background opens the app. Mark-got from the large widget through an App Intent that writes a pending op into the App Group; the app applies it into the shared queue at next launch or foreground (the app side is plain TypeScript with unit tests; iOS cannot reach Supabase safely without a stored session, so do not put credentials in the group).
4. App side: write the snapshot into the App Group after each store change (debounced 500 ms, only on iOS), reload timelines, consume pending ops. Keep Android code untouched.

## Acceptance
`npm test`, `npx tsc --noEmit`, `npx expo export --platform ios --output-dir /tmp/t07b-export` pass; `npx expo prebuild --platform ios --no-install --clean` works in a temp copy only (never touch the repo's ios/ or android/) and shows the widget target and App Group entitlement. No secrets or personal data. Report (max 150 words): files, versions added, what is verified, what only a real device can verify.
