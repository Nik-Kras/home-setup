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
| Status | yes | Needed, Researching, Ordered, Delivered, Installed |
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
