# T10: hardening (M4)

Implementer: Opus 5.5 sub-agent in worktree `../home-setup-wt-t10` (branch `t10`). No emulator: tests, tsc and `npx expo export --platform android --output-dir /tmp/t10-export` only. Reviewer: Fable 5.2.

## Do
1. **Sign out**: a Sign out row on the Home tab (or the existing settings area; match docs/design-decisions.md and the design images in design-ref/screens, read from the main checkout). It first tries to flush the queue (the store already does this), clears the session, and asks for confirmation if unsent changes remain ("2 changes not sent yet. Sign out anyway?"). Add a `testID="sign-out"` and keep e2e flow 01 in mind (app/e2e/flows/01-auth.yaml may then use it; update that flow to tap Sign out instead of clearing app data).
2. **Sync status**: a small, calm indicator (Synced / Sending n / Offline) reachable from the header or Home, driven by the queue size and connectivity; no new colours beyond tokens (amber only for pending). Unit-test the pure state function.
3. **Empty and error states** for every list and detail screen: failed load shows a retry; deleted/missing item or task id shows a friendly "not found" with back; offline first launch with no cached data shows the offline state, never a blank screen.
4. **Widget placeholder**: nothing to do here; the orchestrator handles widgets.
5. **Performance**: the Buy and Tasks lists must stay smooth with 300 items (memoise rows, stable keys, FlatList/SectionList settings). Add a pure unit test that derived selectors for 300 items run under 50 ms.
6. `me` comes from the signed-in account everywhere (check there is no hard-coded person left).

## Acceptance
`npm test`, `npx tsc --noEmit`, the export command pass. No secrets, names or addresses in code. Commit on `t10` with message "T10: hardening", ending with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Do not push or merge. Report (max 150 words): files, tests, what you could not verify.
