# Design decisions

Version 4, 2026-11-21 (rated 6.5/10 at v3; v4 fixes the overlap and stretching complaints). History: v1 (muted green, Inter, form sheet) rejected. v2 (light, Nunito, tile list) rated 4/10: too plain. v3 uses research on Magic UI, Aceternity UI, React Bits, 21st.dev and Refero Styles.

## Direction: dark-first, warm-tinted, hairline-built
The sources disagree: the component libraries lean dark with glow, Refero's styles lean warm and light with no glow. v3 takes the shared ground: tinted near-black surfaces, 1px hairline borders, large radii, serif display type, tabular numbers, and **one** accent glow per screen. A light variant is not drawn yet.

## Tokens
| Role | Value |
|---|---|
| Background | `#0E1110` |
| Surface | `#171B19` |
| Floating bar | `rgba(30,36,33,0.88)` |
| Hairline | `rgba(255,255,255,0.08)` (strong: `0.12-0.14`) |
| Text | `#F2F4F1` |
| Secondary text | `#A3ADA7` |
| Muted text | `#7D8782` |
| Accent (brand, actions, delivered) | mint `#5EE0B8`, dark text on it `#06241B` |
| Urgent / Daryna | coral `#FF8A5B` |
| Ordered / kitchen | amber `#FFC457` |
| Bedroom | lilac `#B9A4FF` |

- Tinted fills use the hue at 14-16% opacity with the full hue as text.
- Status chips: Needed (outline), Looking (white 9%), Ordered (amber), Delivered (mint), Installed (solid mint). Always text-labelled.
- Fonts: Instrument Serif (titles, big numbers, room headings), Geist (everything else). Minimum 12-13px for small text, tabular numbers for money.
- Shape: radius 18 rows, 24 tiles, pills for chips, inputs and the floating tab bar. 4px spacing base.

## Screens
1. **List**: serif title and date, person filter. Bento row: progress ring with count (7 of 13) and the **Next up** card (the single accent glow) with a Got it button. Always-visible add bar. Items grouped by room. Floating pill tab bar (List, Home, Budget) with a mint active pill.
2. **Add**: add bar with a mint glow ring and the keyboard open. Suggestions with glyph tiles. Optional room, urgent and person chips.
3. **Item**: large glyph with a faint glow, five-step status with the current step highlighted, one primary action, photo, fields, short activity lines.
4. **Home**: room chips, bento photo grid (first card tall), serif names over photos with a bottom scrim, owner dot. Photo cards stay opaque.
5. **Budget**: bento. "Spent so far" tile (the accent glow) with count-up number and trend line, still to buy and estimate tiles, who-paid split bar, by-room bars.
6. **Android** and 7. **iPhone widgets**: dark cards with hairline borders. Small (count + add), medium (top 3), large (by room, tick circles). iPhone also has a second small "Next up" widget with the glow.

## Motion (to build, not shown in the static mocks)
- List rows spring in on add and removal only, 50ms stagger, about 8% overshoot. No replay on scrolling or reopening.
- Status change feedback under 250ms: tile pulses, check appears, row moves to Got it. Undo toast for 5 seconds.
- Count-up on budget numbers: about 1.5s, once per open; snaps to the value with reduced motion.
- Tab bar pill slides between tabs with a short spring.
- Confetti only when a whole room is finished.
- Respect reduced-motion everywhere. Widgets are static (no animation possible).

## Rules from the research
- One accent glow per screen at most. No continuous glows, shimmer, marquee, border beams or aurora.
- No hover-only effects, no pointer-following spotlight, no tilt on list rows.
- No blur on lists or photos; blur only on the floating tab bar (translucent surface on Android).
- Photo surfaces are opaque so pictures stay readable.
- Avoid the generic purple-to-orange gradient.
- Touch targets 44px or larger. Contrast checked for text on every surface.

## Taken from each source
- Magic UI: bento grid, number ticker, animated list spring, ring progress, confetti on a milestone.
- Aceternity UI: dark card with hairline, sliding pill tab indicator, one gradient-border hero card, stateful button feedback.
- React Bits: spring values, count-up, glass pill nav, dark violet-tinted neutrals.
- 21st.dev: stat tile, status badge, list row structure, empty state (patterns only; its source could not be read).
- Refero: warm neutrals, serif headings at regular weight, tonal text ladder, structure from hairlines and tone, one accent.
- Bring!: picture tiles, rooms as sections, recents, small count widget.

## Reviewer suggestions not adopted (decide before building)
- Reduce five statuses to three (Need, Got, Placed).
- Merge "assigned to", "bought by" and "owner" into one person field.
- Defer Budget, comments and the large widget.

## Open
- Hand-drawn glyph set (about 60 items) is the largest asset task; room icon is the fallback.
- A light theme variant.
- Success criteria once built: add in 5 seconds or less, mark as got in one tap, a change shows on the other phone in 2 seconds or less when the app is open, 20 offline edits apply after reconnecting.

## v4 changes (review loop)
Each iteration: render every screen to a PNG, run an automated overflow/overlap check, look at the images, run UI analysis agents (impeccable, design-review/ui-ux-pro-max, taste/accessibility), fix, repeat. Iterations 1-6 fixed:
- Floating tab bar covered the last list row. Scroll areas now end above the bar (bottom padding 96px), the bar is opaque, and a scrim fades the list.
- The tall Home tile was stretched. Home is now a uniform two-column grid (aspect 1:1.02) and shows only items that are really in place.
- Item icons overlapped captions on Home. Icons now sit in the area above the caption.
- Medium and large widgets overflowed their frames and ran into the dock. Heights were set from the content (medium 188, large 336) and the large widget shows four rows.
- Add screen: one Add button only; options split into Room and Who rows with Urgent; selected chips carry a check mark; suggestions use a plus button instead of "Tap to add".
- Next up and progress ring merged into one 84px card to give the list more room.
- Urgent items get a coral left edge as well as the word "Urgent".
- One status vocabulary everywhere: Needed, Looking, Ordered, Delivered, Installed (list, item stepper, widgets).
- Numbers agree across screens: 13 items, 7 got, 6 left; budget £1,284 spent of £1,900, £616 to buy, rooms sum to £1,284 with an "Other" row.
- Contrast: secondary text `#AEB8B2`, muted `#98A29C`, tracks 14-18% white, dashed borders 38% white, input borders 38% white. Tap targets 44px or more.

## Not done yet (from the reviews)
- Focus rings and `aria-pressed` states are only partly drawn in the mocks; they belong in the build.
- Photos on Home are placeholders until real photos exist.
- Row-complete animation (strike, then collapse in 240ms), ring draw-on and stepper fill are specified, not shown.
- A light theme.

## Tasks screens (added 2026-11-21)
Same look and tokens as the rest. The tab bar has four tabs: Buy, Tasks, Home, Budget; the active tab shows its label.
8. **Tasks (my list)**: Mine / Daryna / Both switch, the urgent deadline card (the one accent glow), most urgent tasks, shared tasks with two person dots, and group chips (utilities, address, safety, flat notes).
9. **Task detail**: title, due and reference chips, status switch, a checklist with a photo count per item, a note with why it matters, and a primary action (ask Claude to draft the message).
10. **Task group**: progress bar, a tip banner, and a dense checklist with tags (proof needed, paid service).
11. **Add task**: Item or Task switch; when, group, who (Me, Daryna, Each of us), and a reminder toggle.
12. **Flat notes**: contract facts as cards; unconfirmed items are highlighted and can become tasks.
13. **Task widgets**: Android and iPhone, small (deadline countdown, tasks due today or shared progress) and medium (my tasks with due chips).
14. **Tasks, other person's view**: a card for what is waiting on that person (the other person has finished a shared task), their own tasks, and shared tasks.
15. **Shared task**: one card per person with status, progress and their own steps; a note that the task closes when both are done; activity; actions: mark mine done, nudge.

## Colour meaning, as built (2026-11-21)
Following the decision to use cleaner colour meaning: coral is only for urgent (the "!" badge and the word Urgent); mint is done, primary actions and Nikita; **Daryna is lilac**; amber is only in transit (Ordered, In progress) and to confirm; item tiles are neutral.

**Update 2026-11-22 (T12, user feedback):** item glyph tiles use the design's room colours again (kitchen and hallway amber, living room mint, bedroom lilac; bathroom sky blue, not drawn in the design; other rooms neutral), with the design's glyph set picked by item name and falling back to the room (`app/src/domain/glyphs.ts`). Owners show as small coloured dots in meta lines, as in the design. The task note banner is amber with an info mark, as in the design. People appear as initial discs (filled = done, outline = waiting). The mockups on the canvas still show the earlier colours.
