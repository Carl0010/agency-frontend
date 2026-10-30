# Arrival time, part 2: re-plans, confidence answers, late-card notifications

Status: backend built, tested and committed 2026-10-30 in `/home/chandan/Desktop/agency-mvp-clone`,
branch `feat/workspace-uuid-urls` (commit `a92658c`, plus `789afdc`; not pushed). Written by the
backend session for the frontend session. Frontend work: **implemented**, with
verification recorded below.

**Build [ARRIVAL_TIME.md](ARRIVAL_TIME.md) first.** This builds on its chips, project header and
settings. Do not change the backend. If the contract looks wrong, stop and write an
`ARRIVAL_TIME_REPLANS_CONTRACT_BLOCKER.md` handoff here.

Run the API with migrations up to 0012: in the backend folder, `npm run db:migrate`, then
`npm run dev:api`.

Read first:

- Design: `/home/chandan/Desktop/agency-mvp-clone/docs/ARRIVAL_TIME.md` ("Lateness and re-plans",
  "Confidence answers")
- Spec: `/home/chandan/Desktop/agency-mvp-clone/docs/product/srs/Requirement Specifications - Deliverable 1 - Arrival Time (EN).md`
  (rules 4 and 5)
- Contract: `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/openapi.yaml` (`ReplanView`,
  `ReplanResponse`, `ApplyReplanRequest`, `ConfidenceView`, `AnswerConfidenceRequest`,
  `NotificationType`, `ErrorCode`)
- Changelog entry "2026-10-30 — Re-plans, confidence answers and late-card notifications" in
  `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/CHANGELOG.md`

## The idea in one paragraph

When a card is expected after its due date, the app suggests a **re-plan**: move the due dates of
up to three cards just ahead of it in the same list, so it is worked on sooner and arrives on time.
A person applies it with one click; it is never applied for them. Once a week, agency members are
asked anonymously whether the project will be finished on time (yes / unsure / no); from three
answers on, the team's view moves the project's confidence and is shown as a tally. When a card
becomes late, its assignees and the project admins get one in-app notification.

## The contract

| Route | Who | Returns |
| --- | --- | --- |
| `GET /cards/:id/replan?project=` | agency members (`404` guests) | `{ replan: { projectId, cardId, changes: [{ cardId, title, fromDueOn, toDueOn }], arrivesOnAfter } \| null }` |
| `POST /cards/:id/replan?project=` `{ changes: [{ cardId, toDueOn }] }` | agency members | `{ replan }` as applied |
| `GET /projects/:id/confidence` | agency members (`404` guests) | `{ projectId, weekStart, answeredThisWeek, askNow, aggregate }` |
| `PUT /projects/:id/confidence` `{ answer }` | agency members | the same view after answering |

- `?project=` is the project whose board the user is on (as for other card routes).
- `replan` is `null` when the card is not late, there isn't enough history, or no re-plan works.
  Only ask for one when the card's `lateDays > 0`.
- POST: send the suggested `changes` back unchanged (`cardId`, `toDueOn`, same order). Each is applied
  as a due-date edit by the user, so the normal `card.updated` realtime events follow, and an
  `arrival.changed` a few seconds later. `409` with `error.code === 'replan_outdated'` means the board
  moved on: fetch a fresh re-plan and show it. `402` when the workspace is lapsed.
- `answer` is `'yes' | 'unsure' | 'no'`. A second answer in the same week is `409` with
  `error.details.reason === 'already_answered'`. `askNow` is true when the user hasn't answered this
  week and the project has open cards. `aggregate` `{ yes, unsure, no }` is null below three answers.
- Notifications: a new `NotificationType`, `card_late` (label "Late cards"). It appears in the inbox
  like the others and in the preferences grid, where email and push default to off.

## What to build

### 1. Re-plan on a late card

On the late chip (and the card detail's arrival line) for agency members: a "Re-plan" action. It
fetches `GET /cards/:id/replan` and shows the suggestion in plain words, built from `changes`:
"Move ‘Blog setup’ to Fri 6 Nov and ‘Homepage’ arrives on time (Thu 5 Nov)." (one line per change,
dates from the `YYYY-MM-DD` values, no timezone conversion). Two actions: "Apply" (POST) and
"Dismiss" (close, nothing changes). When `replan` is null: "No simple re-plan brings this card back
on time." Never offer it to guests.

### 2. Weekly confidence prompt

On the project page, when `askNow` is true: a small, dismissible prompt, "Will this project be
finished on time?" with Yes / Unsure / No. Say it is anonymous. After answering, show the tally when
`aggregate` is not null ("3 yes · 1 unsure · 1 no this week"), otherwise "Thanks, the team's view
shows once three people have answered." Never show who answered.

### 3. Late-card notifications

Render `card_late` in the inbox and bell like other card notifications (its `title`, `body`, `url`
come ready-made). Add "Late cards" to the preferences grid; it needs no special handling.

## Tests

- Unit: the re-plan sentence from `changes`; the prompt's states (ask, answered without tally, tally).
- E2E: seed a steady project (one card into a done list on each of the last 30 weekdays; see
  `apps/api/test/arrival-replans.int-spec.ts` in the backend for the exact recipe), make a card late,
  apply its re-plan and see it on time after `arrival.changed`; answer the prompt once and get the
  `already_answered` state on a second try.

## Frontend implementation and verification

Late member cards offer a re-plan in the board, List and detail views; outdated
plans are refreshed and failures are surfaced. The project prompt accepts one
anonymous answer and shows only the API's aggregate. Inbox rendering accepts
`card_late`, and preferences are populated by the API.

Unit tests cover re-plan text and confidence states. The real-API browser journey
seeds 30 weekdays of history, applies a plan and polls until the card is on time;
it also exercises the stale-plan recovery. A separate journey checks a second
confidence answer returns `already_answered`.
