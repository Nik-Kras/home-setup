# T08a: Buy, Tasks, add-task and group polish

Implementer: Opus 5.5 in its own worktree, branch `t08a`. Reviewer: Fable 5.2. You own ONLY these files: `app/src/app/(tabs)/index.tsx`, `app/src/app/(tabs)/tasks.tsx`, `app/src/components/TaskRow.tsx`, `app/src/app/add-task.tsx`, `app/src/app/group/[name].tsx`, `ChoiceChip.tsx`, `GroupChips.tsx`, `SwitchRow.tsx`, and new files you create. Do not touch other screens (another agent works on Home, Budget, item, task detail and notes).

Findings from a visual review of the real app against the design (`design-ref/screens/Main.png`, `Tasks.png`, `AddTask.png`, `TaskGroup.png`; read them from the main checkout path in docs/tasks/README.md):
1. Tasks screen lacks the design's focal deadline card. Add a card (the single accent glow on the screen, hairline plus soft glow, no gradient fill) for the open task of the current list with the nearest due date, or the most urgent undated one: eyebrow "Due <weekday> <day> <month> · <n> days left" (coral only when overdue or due today, otherwise secondary text), serif title, progress ("3 of 6 steps") if it has steps, and a "Continue" button that opens the task. Hide it when no task is due or urgent. Domain helper (pure, tested) picks the task.
2. The due chip on task rows is amber; amber is only for in-transit and to-confirm. Use the neutral chip (white 9% fill, `colors.text`); coral stays for overdue or due today with a coral tint.
3. Three controls precede the first task (add bar, a two-line "Each of us does it" switch and "More options"). Move the "Each of us" switch into the add-task modal (it already exists there) and keep a single small "More options" link under the add bar.
4. Buy row meta wraps and leaves "Urgent" alone on a second line. Make the meta one line (`numberOfLines={1}`, ellipsize) and drop the redundant word "Urgent" from the meta (the "!" badge has an accessibility label).
5. Buy "Next up" title truncates after about 14 characters. Allow two lines (`numberOfLines={2}`) with a smaller serif size (24) when it is long; keep the "Got it" button visible.
6. Hide "Got it (0)" when no item is got, and do not draw the ring's mint cap dot at zero progress (use a `strokeLinecap` of 'butt' when the fraction is 0).
7. Add-task modal: the selected "When" chip can be clipped off-screen. Use wrapping rows (`flexWrap: 'wrap'`) for When, Group and Who instead of horizontal scroll, so every chip and the selected state are visible.
8. Group screen: confirm that a chip on the Tasks screen opens `/group/<name>` and renders the group screen (progress, rows with subtitle, done tasks collapsed); fix if it routes elsewhere. Add an empty-group state.
9. Targets: any control under 44dp visually (status chips on rows are decorative, but the "More options" link, checkboxes and chips) gets `hitSlop` or a 44dp minimum.

## Acceptance criteria
- Matches the design images where they differ today; colour meaning rules hold; text 13px or more; 44dp targets; no nested interactive elements; no clipping at 1.3x font scale (use minHeight not fixed heights).
- `npm test`, `npx tsc --noEmit`, `npx expo export --platform android` pass; new pure logic is tested.
- Commit on branch `t08a` ("T08a: buy, tasks and add-task polish", co-author line as in the README). Report in max 120 words.
