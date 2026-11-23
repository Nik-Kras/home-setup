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
- Status change feedback under 250ms: tile pulses, check appears, row moves to Got it. Undo snackbar above the tab bar for 6 seconds (15 with a screen reader) after every edit (T11).
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
Following the decision to use cleaner colour meaning: coral is only for urgent (the "!" badge and the word Urgent); mint is done, primary actions and Nikita; **Daryna is lilac**; amber is only in transit (Ordered, In progress) and to confirm; item tiles are neutral. People appear as initial discs (filled = done, outline = waiting). The mockups on the canvas still show the earlier colours.

**Update 2026-11-22 (T12, user feedback):** item glyph tiles use the design's room colours again (kitchen and hallway amber, living room mint, bedroom lilac; bathroom sky blue, not drawn in the design; other rooms neutral), with the design's glyph set picked by item name and falling back to the room (`app/src/domain/glyphs.ts`). Owners show as small coloured dots in meta lines, as in the design. The task note banner is amber with an info mark, as in the design.

## Status changes and Undo (T11, 2026-11-22)
From user feedback ("Got it" jumped to the end and could not be reverted):
- One stage per tap. The primary action names the next stage: Mark looking, Mark ordered, Got it (only when the next stage is delivered), Mark installed. Same on the Next-up card and the item screen. A row's tile only opens the item.
- The status chip on a row opens a sheet with every stage; any stage can be picked, forwards or backwards. The item screen's stepper does the same. Delivered carries the hint "got it" in the sheet.
- Every edit (status, ticks, my task status, assignment, prices, quantity, fields, delete) shows "<Item> → <change>  Undo". Undo puts back only what still holds the value that edit set; if the other person changed it since, theirs stays and the snackbar says "Not undone: it was changed since" (also when the server reports that the conditional patch matched nothing). After an Undo the snackbar only says how it went; it never offers a second Undo in the same spot. An edit not yet sent (offline) is taken back from the queue, so it never reaches the server.
- Delete is a soft delete with Undo instead of a confirmation. Moving a status back needs no confirmation either: Undo restores the dates.
- When an item arrives (delivered, or straight to installed) without a paid price, an optional "Paid for <item>? Paid by [Nikita] [Daryna] £___ Save / Skip" card (payer preselected to me, saved as bought by) floats above the snackbar; it hides by itself after 20 s untouched and remembers nothing.
- Tasks tab: a collapsed "Done (n)" list at the bottom of Mine and the other person's view, where a finished part can be opened and unticked. Both already lists finished shared tasks in place.
- Widgets follow the same rule: the large widget's circle moves an item one stage per tap (label "Mark looking: <name>", "Got it: <name>", "Mark installed: <name>"), as a patch conditional on the status the widget showed. The row shows its new stage at once and leaves the widget only once it is got (or installed when it needs installing). A mistaken widget tap is reverted from the row's status chip in the app.

## UX audit fixes (T14, 2026-11-22)
From a harsh UX audit after user feedback ("nothing could be reverted, price could not be entered, nothing checkable"):
- **Installed is always there.** The item stepper and the status sheet show all five stages. For things that need no installing, Installed is marked "optional"; the main button still stops at Got it (Delivered) and offers Mark installed only when Needs installing is on. The Needs installing and Urgent switches sit right under the stages. A line under the stepper says what is left ("Delivered. Still to install.").
- **Sheet wording**: each stage has a quieter second line ("Next", "You have it", "Optional · only if it needs fitting") instead of dotted suffixes.
- **Got it shortcut (shop case)**: on the Next-up card a labelled outline "Got it" next to the main button, and a "Got it" button at the top of the status sheet a row opens, go straight to Delivered while the item is Needed or Looking. This is the only jump; Undo puts it back.
- **Next up follows the person filter**; with no filter it prefers my items and unclaimed ones, and its meta line says "Not claimed yet" or "For Daryna".
- **Prices**: the optional "Paid?" prompt also appears when an item is marked Ordered (people pay online then), and once more on arrival if skipped; it hides after 30 s untouched. Every ordered or got row without a paid price has a small mint "Add price" pill that opens the same form in a sheet. A price saved without a buyer counts as bought by me. Budget shows "Unassigned £x" (a neutral segment) for spend with no buyer, so the split adds up to Spent.
- **Tasks**: Edit on a task opens a full sheet (title, when, group, who, urgent, notes, reference, Delete). Adding or taking off a person changes only that person's part; Save says when it removes someone's part. Deleting a task or a flat note is a soft delete with Undo. Undo lasts 10 s for deletes, 6 s otherwise (15 s with a screen reader).
- **Task rows**: where I have a part the circle ticks my part on any list; a task that is only the other person's shows their initial disc, never a circle that cannot be ticked. Mine has a "Shared with Daryna" section. Group chips and Flat notes sit right under the switch. The add bar's options button reads "Options". Done toggles use a chevron.
- **Rows** are compact as in the design: one-line name, one meta line, a status chip without a chevron.
- **Sync**: a small pill in the tab headers says "Offline · 3 unsent" or "Sending 2" (after 1.5 s) and hides when synced.
- **Widgets**: the large widget's circle is an arrow in a circle ("next stage"), not a tick.
- **Item screen**: the header meta shows the paid price ("£84.99 paid") once there is one; the activity lines come from the database's activity log ("Daryna marked it ordered, 2 h ago"), falling back to "made the last change" offline.
- An account with no member row is never shown as the test account.
- Review fixes: Undo of a change to who a task is for puts back exactly the people it had (only while it is still for the people the edit left). Taking a person off is conditional on the status this phone saw; when the server removes nothing (changed since, the last person, or an account that may not delete) the snackbar says "Could not remove Daryna from <task>". An account that may not delete is not offered choices that take someone off. Migration 0007 (not applied yet) refuses removing a task's last person. Next up does not offer a step on the other person's item without a filter: it says "For Daryna" and opens the item. Rows have a small "Got it" pill on my or unclaimed items still Needed or Looking. Offline edits keep the pill on "Offline · n unsent", and its slot keeps its height.

## Design completeness (T13, 2026-11-22)
User feedback: the app must look and work like the design. Added what the design showed and the app lacked:
- **One add screen** (Add.png, AddTask.png): back, an Item / Task switch, the glowing bar, then the options for the chosen kind; the typed text carries over when switching. The Buy list's "Add something..." bar and the widget's "+" (`homesetup://add-item`) open it on Item with the keyboard up; "More options" on Tasks, a group's "+" and a flat note's "Make it a task" open it on Task. The task options are unchanged (when, group, who, urgent).
- **Suggestions while typing** (`domain/suggestions.ts`): the household's own item names first (marked "Already on the list" when still open), then a built-in list of about 60 common things with their room. Tapping a suggestion fills the name and room (the glyph follows the name); its "+" adds it at once. "Add "<text>" as new" adds the typed text. With nothing typed, a few common things not on the list show as chips.
- **Details** under the bar: room chips (one is always selected: the suggestion's room, else guessed from the name, else the last room used, else the first room), who buys it (Me preselected, the other person, Unclaimed) and Urgent.
- **After adding**: the snackbar says "Added to <room>  Undo  Change". Undo soft-deletes the new item (or takes its insert back from the queue if it was never sent); Change opens its item screen.
- **"I'll buy it"**: an unclaimed row shows it in mint where the owner would be, and the item screen's "Assigned to" row has the same pill. One tap assigns it to me; Undo puts it back. On a row it is a small mint pill with a 44dp touch area, like the row's other pill.
- **Comments** (Item.png): a comment bar fixed at the bottom of the item and task screens; comments show among the item history lines by time, as "<Name> commented: <text>, 5 min ago". They go through the offline queue as insert-only rows in `comments` (author stamped by the database). Comments cannot be edited or deleted yet.
- **Budget trend** (Budget.png): "+£X this week" beside "Spent so far" and a mint trend line of cumulative spend from the first paid item to today (`domain/spendTrend.ts`; a price counts on its delivery day, else installed, else added, so the line ends at the total).
- **Tab bar on Flat notes and a task group** (FlatNotes.png, TaskGroup.png), with Tasks lit; a tab goes back to that tab.
- The Tasks add bar's "+" opens the same add screen on Task (typing there and pressing Enter still adds at once). A row just added is outlined in mint while its snackbar (10 s) shows.
- Review fixes (T13): a typed name goes in the same room its suggestion shows (`roomForName`: exact suggestion, then the one it begins, then keyword rules with a room named in the item first, so "Kitchen bin" is Kitchen and "Bedside lamp" Bedroom). A name already on the list is never added silently: "<Name> is already on the list · Open / Add anyway" (a suggestion already on the list opens it). "+£X this week" and the trend follow when a price was paid (`price_paid_at`, migration 0008; older prices fall back to delivery). "I'll buy it" is sent only while the item is still unclaimed; if not, "Daryna already took it". Each side of the add screen keeps its options across switching; the widget's "+" closes onto the Buy list. My own comments can be deleted (soft, with Undo; migration 0009), show the account the database stamps (Claude for the test account) and are kept for an offline cold start; the newest 200 per item or task show.
- Not built from the design: "Remind me 2 days before" (needs notifications), "Nudge", and "Ask Claude to draft the email".

## Final visual polish (T15, 2026-11-23)
- Small text is 13px or more everywhere (Next up label, ring total, segment counts, the urgent "!", Home chip counts, person disc initials).
- The item stepper's labels stay on one line, never hyphenated: each step is as wide as its label plus an equal share of the rest.
- The sync pill sits on the title line of Buy, Tasks and Budget (right of the title, wrapping to two short lines when narrow) and on Home's count line under the Room/Owner switch. It no longer reserves an empty band under the header, and showing it never moves the list.
- The Next up meta line wraps to two lines, then ends with an ellipsis.
- Disabled mint buttons (Send comment, Add, Save price, sheet Save, Sign in) turn neutral with muted text and report themselves as disabled; they no longer look like a dimmed active button.
- Widgets fill their height: the large widget shows as many rows as fit (up to 12) with "+n more" when items remain, and the medium widget up to six rows, with "+n more" when that line fits too. The header and the "Updated" line stay; taps and the one-stage advance are unchanged.

## Last cosmetic fixes (T17, 2026-11-23)
- **Budget with no prices** shows only "Spent so far £0" and "No prices yet. Add one on an item." (no "of £0", empty bars or £0 tiles). With estimates but nothing paid, Who paid shows "No spending yet" without an empty bar; rooms keep "£0 of £45" (spent of estimated).
- **Home header** as in Home.png: title and count on the left, the Room/Owner switch centred beside both lines; the sync pill sits on the title line as on the other tabs. Chips and cards start right under the header. Tile captions never cut the person's name.
- **No mid-phrase wrapping**: the Next-up meta line ("Kitchen · about £20 · unclaimed", "for Daryna") and the sync pill ("Offline ·" over "3 unsent") break only after a "·"; the Next-up meta may take three lines beside two buttons. "Next up · urgent" shortens to "Urgent" if it would wrap.
- **Row pills**: an unclaimed row shows only "I'll buy it" (Main.png); the row's "Got it" is only on my items still Needed or Looking. Got it stays on the Next-up card and the status sheet.
- **App row** on Home: "Up to date · 4f2a9c · 23 Nov" (last 6 characters of the update id and the day it was published; "built in" for the update inside the app), or "Update ready · ... Restart".
