# T02: Item detail screen

Implementer: Opus 5.5 sub-agent in its own git worktree. Reviewer: Fable 5.2. Depends on T01 (routes and `updateItem`, `setItemStatus` actions).

## Goal
Replace the placeholder `src/app/item/[id].tsx` with the real item detail screen from the design image `design-ref/screens/Item.png` (HTML source `design-ref/source/Item.dc.html`; both are private and local, read them with the Read tool).

## Do
- Header: back button (44dp), "Edit" is not needed (fields edit in place).
- Title block: glyph tile, serif item name (editable by tapping: simple text-input sheet), meta line (room, quantity, price estimate).
- Status card: five-step progress (Needed, Looking, Ordered, Delivered, Installed) showing done, current (amber) and pending segments, each segment 44dp tappable to set that status via `setItemStatus`, and one primary button with the next action ("Mark as ordered", "Mark as delivered", "Mark as installed"; hidden when finished, and "Installed" is skipped for items with `needsInstall` false).
- Field rows (tap to edit in a small bottom sheet built with RN `Modal`; create `src/components/Sheet.tsx`): Assigned to (none, Nikita, Daryna), Price (actual price, decimal input, shows estimate), Bought by (none, Nikita, Daryna), Product page (opens the link; edit in the sheet), Room (list of rooms).
- Urgent toggle row and a "Needs installing" toggle row.
- Footer text: "Added <date> by <name>" and "Last change by <name>" from `addedAt` and `updatedBy` ("Claude" for the claude actor).
- Photo and comment areas are NOT in this task (photos are M2, comments later); leave no dead controls.
- All edits go through the store actions only. Pure helpers (next-action label, which statuses are skipped) go in `src/domain/items.ts` with tests.

## Acceptance criteria
- Matches `Item.png` in structure, spacing, type and colours; coral only for urgent, amber only for the current in-transit step, mint for done and primary action, neutral tiles.
- Every control has an accessibility role and label; targets 44dp or more; text 13px or more; no nested interactive elements.
- Works with long names (wraps, no clipping) and with missing optional data (no price, no room, no assignee).
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass; new pure logic is unit tested.

## Report back (max 150 words)
Files changed, results, anything not done.
