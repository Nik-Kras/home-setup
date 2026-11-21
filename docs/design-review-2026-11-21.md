# Design review, 2026-11-21

Full review of all 15 screens (Buy block 7, Tasks block 8) by three reviewers: coherence (impeccable skill), pixel-level defects, accessibility and flow. Screens were rendered with headless Chrome, checked by an overflow/overlap script, and read as images.

## Scores
- Coherence: 7.6 / 10 (per screen 6.5 to 8). Strong: serif titles and numbers with Geist UI text, the floating tab bar, the two-person shared-task cards, the Budget bars, the dark tinted surfaces.
- Accessibility: no text-contrast failures (lowest 5.7:1). Failures were non-text contrast, a few small targets, markup and focus states.

## Fixed in this pass
- FlatNotes last card clipped under the tab bar; Budget sparkline hard edge; segmented control uneven widths; widget "+" misaligned with pills and uneven bottom padding; TaskGroup add button overshooting the margin; stray separator on the WiFi row.
- Interactive outlines raised to about 3:1 (white 42%); progress tracks raised (white 24%); Needed chips filled instead of outlined; targets raised to 44px (segments, Room/Owner toggle, "Make it a task", suggestion plus with a larger hit area); `aria-pressed` removed from links; focus rings added everywhere; urgent marker is now a "!" badge plus the word "Urgent" (the coloured left stripe looked like a clipped border); pill heights unified to 28px; section labels in forms are sentence case; task-detail "In progress" is amber like the shared task; the other person's tab says "Nudge Daryna" instead of "Mark mine done".

## Decisions still open (changes the look or flow)
1. **Got-it control on Buy rows.** Today a tap on the category icon tile marks an item got; it does not look tappable. Option: a check circle on the left and the icon beside the title.
2. **Real input on the Buy list.** "Add something..." is a button to another screen. Option: a live input, type and press Enter (about 3 seconds).
3. **Glow.** Remove the accent glow and ambient gradients (hairline border and flat fill only), as two reviewers suggest, or keep one glow per screen.
4. **Colour meaning.** Coral marks both Daryna and urgent; amber marks kitchen tiles, Ordered, To confirm and due dates; mint marks Nikita, done and primary. Option: owner as an initial disc, neutral room tiles, coral only for urgent.
5. **Icon tiles in rows.** Keep the tinted 44px tiles, or use bare 26px icons.
6. **Vocabulary.** Needed (Buy) vs To do (Tasks); to get / got it / left; Both vs Each of us.

## Build-time requirements found in the review
- Rows must not nest a button inside a link; the title is the link and the check is a sibling button.
- Use min-height and allow wrapping so text at 200% size does not clip (fixed heights in the mocks are for drawing only).
- Text floor 13px except monogram letters.
- The Android small widget should show what is urgent, not only a count; list widgets show the urgent marker.
