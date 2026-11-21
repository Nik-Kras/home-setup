# Design decisions

Version 2, 2026-11-21. The first design (muted green and greige, Inter, form-style add sheet, card list) was rejected: colors, fonts, style and layout. Version 2 follows a critique by three reviewers (design critique, simplicity and assumptions review, and a study of the Bring! shopping-list app).

## Principles
- Speed first: adding an item or marking it as bought must feel instant. No form to fill in.
- Recognition over reading: every item has a picture tile.
- Friendly and light, not admin-like.

## Look ("Fresh Market")
| Role | Light |
|---|---|
| Background | `#FAF8F4` |
| Surface | `#FFFFFF` |
| Text | `#17211E` |
| Secondary text | `#5B6662` |
| Brand / primary action | `#0E7C6B` |
| Accent (urgent) | `#C2410C` |
| Tints | brand `#CDEFE7`, warm `#FFE7B8`, neutral `#ECE9E2` |

- Room tiles: kitchen `#FFE9C2`, living room `#CDEFE7`, bedroom `#E6E3FA`, bathroom `#D8EBF8`.
- People colors: Nikita teal, Daryna orange. Claude is shown as small text ("by Claude"), not as a person to assign.
- Type: Nunito (headings, item names), DM Sans (meta text). Minimum 13px for meta text and chips.
- Shape: 16px radius on rows and tiles, pill shapes for chips and the add bar. Rows are flat; one soft shadow only on floating things (add bar, tab bar).
- Icons: rounded 2px stroke set. Item pictures are two-tone glyph tiles; a photo replaces the glyph once added.
- Status is never colour alone: Needed (outlined), Researching (neutral), Ordered (warm), Delivered (brand tint), Installed (solid brand), each with a text label.
- Dark mode: a dark variant of the same palette is planned (not yet drawn).

## Screens
1. **Our flat (Buy and install)**: one line header with counts and person filter, an always-visible add bar, items grouped by room, "Got it" group collapsed at the bottom. Tap the item tile to mark it as got. Tap the row for details.
2. **Add**: the add bar with the keyboard open. Suggestions with pictures, tap to add. Enter adds and keeps typing. Room, urgent and person are optional and sit under the suggestions.
3. **Item detail**: status with one clear next action, photo, assigned to, price, bought by, link, comments.
4. **Home**: the inventory. Room tiles on top, a two-column photo grid, an owner colour dot per item, toggle by room or by owner.
5. **Budget**: automatic totals: spent so far, who paid, by room.
6. **Android widgets** and 7. **iPhone widgets**: small (count and add button; a second small shows the next urgent item on iPhone), medium (top three items with status), large (grouped by room, tick circle to mark as got).

## Widgets
- Every widget has a visible add button and a tap target of at least 44px.
- Widgets read from a local cache first, so they never show empty. Large widgets show "Updated just now".
- Real-time target: a change shows on the other phone's widget within about a minute when online. iPhone widgets cannot be truly live (the system limits refreshes), so the target is stated as "about one minute", not "instant".

## Taken from Bring!
Picture tiles as the item face, tap as the main action, rooms as the equivalent of store aisles, a "recents" row, and a small widget with a count and a preview. No Bring! branding, icons or illustrations are used.

## Reviewer suggestions not adopted (decide before building)
The simplicity review suggested cutting features that were agreed earlier. They are kept in the design for now and need an explicit decision:
- Reduce five statuses to three (Need, Got, Placed).
- Make priority optional only (it is optional in v2 already) or drop it.
- Defer the Budget tab and comments.
- Merge "assigned to", "bought by" and "owner" into one person field.
- Defer the large widget (riskiest to build on both platforms).

## Open
- Item pictures: a hand-drawn glyph set (about 60 items) is the largest design effort. A generic room icon is the fallback.
- Success criteria to verify once built: add in 5 seconds or less, mark as got in one tap, a change shows on the other phone in 2 seconds or less when the app is open, 20 offline edits all apply after reconnecting.
