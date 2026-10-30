# Arrival time

Status: backend built, tested and committed 2026-10-30 in `/home/chandan/Desktop/agency-mvp-clone`,
branch `feat/workspace-uuid-urls` (commits `0468841` to `789afdc`; not pushed).

**`ARRIVAL_TIME_CONTRACT_BLOCKER.md` is resolved** in `789afdc`: the API now publishes the countries a
calendar may use (`GET /calendar-countries`), refuses any other, and says whether public holidays
count (`publicHolidays`). Section 6 below is updated. Contract changelog entry: "2026-10-30 —
Supported calendar countries". Written by the
backend session for the frontend session. Frontend work: **implemented**, with
verification recorded below.

Run that API locally (it needs migrations 0009 to 0011): in the backend folder, `npm run infra:up`,
`npm run db:migrate`, then `npm run dev:api` (http://localhost:4100), or `./start.sh`.

Do not change the backend. If the contract looks wrong, stop and write an
`ARRIVAL_TIME_CONTRACT_BLOCKER.md` handoff here.

Read first:

- Design: `/home/chandan/Desktop/agency-mvp-clone/docs/ARRIVAL_TIME.md`
- Spec: `/home/chandan/Desktop/agency-mvp-clone/docs/product/srs/Requirement Specifications - Deliverable 1 - Arrival Time (EN).md`
- Contract: `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/openapi.yaml`
  (`ArrivalSettingsView`, `BoardArrivalsView`, `ProjectArrivalView`, `WorkspaceCalendarView`, and
  their routes), realtime table in `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/README.md`
- Changelog entries "2026-10-30 — Arrival time settings" and "2026-10-30 — Arrival time estimates" in
  `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/CHANGELOG.md`

## The idea in one paragraph

Every open card and every project gets an **arrival time**: the day it is expected to be finished,
with a **confidence** ("Arrives Thu 12 Nov, 82% sure"). It is estimated from how fast this project
has actually finished cards, never from guesses and never by comparing people. A card due before it
is expected to arrive is **late** by some working days. Project admins mark which lists hold finished
work (**done lists**) and can give the project a **target date**. Guests see the project's arrival
time in the portal, and each card's only if a project admin turns that on.

## The contract

| Route | Who | Returns |
| --- | --- | --- |
| `GET /boards/:id/arrivals` | anyone who sees the board | `{ projectId, history?, cards: [{ cardId, arrivesOn, confidence, lateDays? }] }` |
| `GET /projects/:id/arrival` | anyone who sees the project | `{ projectId, history?, arrivesOn, confidence, lateDays?, computedAt? }` |
| `GET /projects/:id/arrival-settings` | agency members (`404` guests) | `{ projectId, doneListIds, targetDate, guestCardArrivals }` |
| `PATCH /projects/:id/arrival-settings` `{ targetDate?, guestCardArrivals? }` | project admins (`access === 'admin'`) | the settings |
| `PUT /lists/:id/done` `{ isDone }` | project admins | the list's project's settings |
| `GET /calendar-countries` | anyone signed in | `{ data: [{ code, name, weekendDays }] }`, the only countries that may be chosen |
| `GET /workspaces/:id/calendar` | agency members | `{ country, timezone, weekendDays, publicHolidays }` |
| `PUT /workspaces/:id/calendar` `{ country, timezone }` | workspace owner and admins | the calendar; a country not in the list is `422` (`details.reason: 'unsupported_country'`) |

- `history` (agency members only): `pending` before the first calculation, `insufficient` until the
  workspace has finished 20 cards, then `enough`. Only `enough` comes with estimates.
- `arrivesOn` and `targetDate` are `YYYY-MM-DD` days in the workspace calendar's timezone. Render
  them as dates, never through `new Date(…)` in the browser's timezone.
- `lateDays` (agency members only) is working days past the card's due date (cards) or the target
  date (project); 0 is on time. Guests never get it, nor `history` or `computedAt`.
- Writes: `402` on a lapsed workspace, `403` without the right role, `422` for a bad date, unknown
  country (`ZZ`) or timezone, or an empty `PATCH`.
- Realtime: `arrival.changed` `{ projectId }` on the project board room, guests included. On it,
  refetch the board's arrivals and the project's arrival. Settings changes also end in one, a few
  seconds later, once estimates are recalculated. There is no event for the settings themselves:
  refetch them after your own write.

## What to build

### 1. Card tiles and card detail

- A small arrival chip on each open card tile that has one: "Arrives Thu 12 Nov" plus the
  confidence ("82% sure"). Read `GET /boards/:id/arrivals` beside `GET /boards/:id` (parallel, its
  own cache key) and match by `cardId`. Cards without an entry show nothing.
- When `lateDays > 0`: a late variant, "2 days late", in the warning tone, readable without colour.
- Card detail: the same, for the board the card was opened from.

### 2. The board's empty states (agency members)

- `history: 'insufficient'`: one quiet line on the board, e.g. "Arrival times appear once the team
  has finished 20 cards." Not on every card.
- `pending`: show nothing; it settles within seconds.

### 3. Project header

From `GET /projects/:id/arrival`: "Arrives Mon 16 Nov · 74% sure", and "3 days past target" when
`lateDays > 0`. Nothing when `arrivesOn` is null.

### 4. Done lists (project admins)

In the list's menu, a "Mark as done list" / "Unmark done list" toggle, shown only to project
admins. Use `doneListIds` from the settings to show which lists are done lists (a subtle marker in
the list header).

### 5. Project settings (project admins)

- Target date: a date picker with a clear action (`null`).
- "Show clients each card's arrival time" switch (`guestCardArrivals`), off by default.
- Agency members who are not project admins see these read-only.

### 6. Workspace settings (owner and admins)

A "Working days" section: a country select built from `GET /calendar-countries` (use its `name`;
never a list of your own), a timezone select prefilled with the browser's timezone, and the
resulting weekend days shown read-only (from the chosen country's `weekendDays`). When the saved
calendar's `publicHolidays` is true, say so in one line ("Weekends and public holidays of the chosen
country don't count as working days"); with no calendar yet, say only that Saturday and Sunday don't
count.

### 7. Guest portal

- Project page: the project's arrival time ("Expected Thu 12 Nov"), with no lateness and no
  history state. Nothing when `arrivesOn` is null.
- Card tiles: arrival chips only when the board's arrivals return cards (the project admin turned
  it on). Never a late variant.

### 8. Credit for the holiday data

The holiday data's licence (CC BY-SA 3.0) asks for credit. Add one line where the product credits
third parties (an About or legal page, or the footer of the workspace settings if there is none yet):
"Public holiday data from date-holidays (commenthol), CC BY-SA 3.0, based on Wikipedia."

## Not in this hand-off

Re-plans, the weekly "will we make it?" answers and late-card notifications come later. Don't build
anything for them yet.

## Tests

- Unit: date rendering of `YYYY-MM-DD` without timezone shifts; chip variants (on time, late,
  none).
- E2E: a project admin marks a done list and sets a target date; a member cannot; a guest sees the
  project's arrival time and no lateness. Seed 20 finished cards (move cards into a done list) to
  get past the history threshold, and wait for `arrival.changed` (or poll) before asserting.

## Frontend implementation and verification

The board, List and portal render API estimates and refresh them on
`arrival.changed`. Project admins can mark done lists and edit arrival settings;
members can read those settings. Workspace owners and admins can choose a
published calendar country and timezone. The guest views omit lateness and use
the API's per-card visibility. The holiday attribution appears in workspace settings.

`src/lib/arrival.spec.ts` covers date formatting and arrival text. The real-API
`e2e/arrival-time.spec.ts` covers 20 finished cards, project settings, member
restrictions, guest visibility, confidence and the workspace calendar. The
mobile dark arrival view was reviewed in [the preview](../previews/arrival-mobile-dark.png).
See [part 2](ARRIVAL_TIME_REPLANS.md) for re-plans and confidence.
