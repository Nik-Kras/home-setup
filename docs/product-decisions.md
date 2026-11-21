# Product decisions

Decided in discussion on 2026-11-21. Users: two people (a couple) plus an AI assistant (Claude). No one else. No sign-up flow, no public users.

## Purpose
Track everything a new home needs: things to buy, things to install, and services to set up. After that, track where every item lives and who bought it, so ownership is clear if the household splits or moves out.

## Two modes
1. **Buy / Install**: the working list. What is still needed and what is its status.
2. **Home**: the inventory. Where each item is, with photos, and who owns it.

## Item fields
| Field | Required | Notes |
|---|---|---|
| Name | yes | |
| Status | yes | Needed, Looking, Ordered, Delivered, Installed |
| Priority | yes | |
| Quantity | yes | default 1 |
| Room | no | editable list: kitchen, living room, bedroom, bathroom, hallway, general |
| Estimated price | no | |
| Actual price | no | |
| Assigned to | no | one of the members (including Claude) |
| Bought by | no | the owner, used for the Home page |
| Link | no | product page |
| Photos | no | shown on the Home page |
| Notes | no | |
| Added at | auto | timestamp |
| Bought / delivered / installed at | auto | set when the status changes |
| Added by, last changed by | auto | includes "Claude" for AI edits |

Services and setup tasks (internet, TV licence, insurance quote) live in the same list as physical items.

## Collaboration
- One shared list, live sync between phones within seconds.
- Comments on items. Claim an item ("I'll buy this").
- Claude has the same rights as a person; every change by Claude is attributed to "Claude".

## Budget
- Fully automated. Users only enter prices.
- Totals per item, per room, per person and overall, estimated vs actual.
- A profile / overview page with a gallery of products and contributions per room and per person.

## Speed
- Adding an item or changing a status takes under 5 seconds.
- Widgets must be fast and good looking. A slow or ugly widget means the app is not used.

## Widgets (both iPhone and Android, required)
- Small: count still needed, plus a quick-add button.
- Medium: top outstanding items by priority with status chips.
- Large: list grouped by room, tap to mark bought.
- Data is current when the widget is shown.

## Offline
- Online-first. Edits made offline are queued and applied automatically when the connection returns.

## Out of scope
- Price search / shopping comparison.
- Multi-household, public users, accounts for others.
- Cost splitting between the two members (possible later).

## Tasks (added 2026-11-21)
The app tracks things to do as well as things to buy. Moving-in jobs: register for council tax, take meter readings, set up utilities, change address everywhere, insurance and safety checks, and checking the move-in inventory against the contract deadline.

### Separate lists, shared tasks
- Each person has their own task list. The Tasks screen has a switch: **Mine**, **Daryna** (the other person), **Both**.
- A task has one or more assignees. **Each of us** means both people get the task and each ticks it off separately (for example "register with a new GP").
- Each assignee has their own status and their own steps. The task is finished only when every assignee is done. The task shows "1 of 2 done" and who is waiting.
- Shared tasks appear in both lists, marked with two small person dots (filled = done, outline = waiting). A person can nudge the other.
- Tasks assigned to one person appear only on that person's list (and in the Both view only if shared).

### Task fields
| Field | Required | Notes |
|---|---|---|
| Title | yes | |
| Assignees | yes | me, the other person, or each of us |
| Due | no | today, this week, a date, or none; shows days left |
| Group | no | utilities, address changes, safety, other |
| Status per assignee | yes | To do, In progress, Waiting, Done |
| Steps | no | a checklist; shared tasks have one set per person |
| Photos and notes | no | e.g. inventory photos per room |
| Reference | no | a contract clause or link |
| Reminder | no | e.g. 2 days before |

### Related
- **Flat notes**: facts from the tenancy contract (rules, who pays for what, things still unconfirmed). Unconfirmed items can be turned into tasks.
- Things to buy for the move stay on the Buy list.
- Claude can add and tick tasks like a person, and can draft messages for a task (for example the letter to the agent).
- Widgets: next deadline countdown, tasks due today, shared-task progress, and a list of my tasks.
