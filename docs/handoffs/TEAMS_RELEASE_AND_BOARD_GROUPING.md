# Finish the teams release, then board grouping

Status: checkpointed at the user's request, 2026-10-16; implementation is in place,
final preview refresh/review remains. The user subsequently requested committing,
pushing the feature branch and continuing another day, superseding the original
no-push instruction below. No PR is opened by this session.

## Checkpoint and resumption

- Backend `faa34c0` was verified using a fresh API dev process. The owner access
  reproduction and member-to-admin promotion regression pass. The Share picker
  already restricted choices to member roles; it does not filter access responses.
  `ACCESS_CONTRACT_BLOCKER.md` is resolved.
- Mobile Teams now stacks identity above controls and gives the add-person select
  a full row. Browser checks verify readable selector text and control placement.
  Star failure/retry, unstar and reload persistence have acceptance coverage.
  The three whitespace warnings were already cleaned in `a358014`.
- Grouping is implemented for member Kanban/List, with URL composition, assignable
  people, atomic swaps, all six timezone-aware due windows, reschedule/Later,
  optimistic rollback, keyboard focus/collapsed destinations and boundary/realtime
  refresh. The portal has read-only due grouping and preserves it on card return.
- Lint, typecheck, 155 unit tests and the production build passed. Five grouping
  journeys and five access/Teams/star journeys passed against the real backend.
  The full 59-check browser suite passed (3.5 minutes) with
  `BACKEND_DIR=/home/chandan/Desktop/agency-mvp-clone PW_CHANNEL=chrome npm run test:e2e`.
  Four checks use panel-motion presentation fixtures; the new access/grouping
  journeys use the real API, with intercepted requests only for failure recovery.
- Remaining: rerun the due-drag journey with its latest screenshot-settling waits,
  review the mobile grouped List screenshot after it actually reaches List, and
  save refreshed previews (Teams, sharing, icon picker, editable List and grouping).
  The previous grouped mobile screenshot captured the preceding Kanban transition
  and a deliberate test-error toast; do not publish that image as the List preview.
  The waits were corrected, but their refreshed capture still needs review.
- Update the preview index, mark this handoff done only after the remaining visual
  work and verification pass, then follow the user's next release instructions.
  Backend source was not changed. Existing PR #4 remains unchanged.

## Original handoff

Written by the backend session for the frontend session.
The backend is finished, tested and pushed on `refactor/api-domains` (latest commit `faa34c0`) in
`/home/chandan/Desktop/agency-mvp-clone`. Do not change the backend. If the contract looks wrong or
incomplete, stop and report it in a handoff here instead of working around it in the client.

**How this session ends:** make focused commits on `feat/teams-project-access`, then **stop and
report**. Do not push, do not open a pull request; the user does that.

## 1. The access blocker is resolved

[ACCESS_CONTRACT_BLOCKER.md](ACCESS_CONTRACT_BLOCKER.md) was a real backend bug, fixed in `faa34c0`
(see the "Fix: the project access list never includes owners or admins" entry in the backend
changelog):

- `GET /projects/:projectId/access` → `members[]` now lists only workspace members (role `member`)
  with a direct grant. Owners and admins are never listed; they administer every project.
- Creating a project no longer stores a grant for an owner or admin creator.
- `PUT /projects/:projectId/members/:userId` for an owner or admin is `422 validation_failed`, so the
  Share dialog must not offer owners and admins as people to add.

To do:

1. Restart the backend so it runs `faa34c0`, and re-run the reproduction from the blocker: a fresh
   owner's project must show no members.
2. Update the Share dialog's "add person" picker to exclude workspace owners and admins. Do not
   filter the access response client-side.
3. Add an e2e check: the owner never appears in their own project's access list, and a member
   promoted to admin disappears from it but keeps admin access.
4. Mark the blocker resolved (status line, plus a short "Resolution" section pointing at `faa34c0`)
   and update the entry in [README.md](README.md).

## 2. Finish the teams release

These are the items the blocker listed as remaining:

- On narrow Teams screens, stack each row's identity above its role and remove controls so names
  stay readable, and give the "Add workspace person" selector its own full-width row. Add a check
  that detects truncated controls, not just page overflow.
- Add acceptance coverage for unstarring, and for a failed star request followed by a retry.
- Remove the three blank-line whitespace warnings in the updated onboarding and project-menu tests.
- Save refreshed previews.

## 3. Board grouping (new)

Read first:

- `/home/chandan/Desktop/agency-mvp-clone/docs/BOARD_GROUPING.md`: the design and its rules.
- `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/CHANGELOG.md`: the entry "Board
  grouping by assignee and due date".
- `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/openapi.yaml`:
  - paths `/cards/{id}/assignees` (PATCH), `/cards/{id}/reschedule` (POST) and
    `/projects/{projectId}/assignable` (GET);
  - schemas `DueWindow` (its description is the grouping rule), `ChangeAssigneesRequest`,
    `RescheduleCardRequest` and `AssignableView`.
- `/home/chandan/Desktop/agency-mvp-clone/docs/backend/LANGUAGE.md`: the terms grouping, due window,
  assignable and reschedule. The API and code say "list"; the UI may label it "Sections".
- This repository's [BOARD_VIEWS.md](../BOARD_VIEWS.md): grouping must fit the Kanban and List
  presentations, filters and drag rules.

Rules:

- **A grouping switch:** List (default), Assignee, Due date.
  - Kept in `?group=list|assignee|due`; unknown values fall back to `list`.
  - Works in Kanban and List.
  - Composes with filters and card search, and survives reload and history.
- **Group in the client** from the existing `GET /boards/:id` tiles. No new board read.
- **Assignee grouping:**
  - One group per assignee, plus Unassigned. A card with several assignees appears in each group.
  - Headers may include assignable people with no cards, from `GET /projects/:projectId/assignable`.
  - Inside a group, cards are in board order (list order, then position).
  - A drag calls `PATCH /cards/:id/assignees` with `{ remove: [source person], add: [target person] }`:
    nothing to remove when coming from Unassigned, nothing to add when going to Unassigned.
- **Due-date grouping:**
  - Overdue, Today, Next 7 days, Later, No due date, Done, computed exactly as `DueWindow` says, in
    the viewer's `timezone` from `GET /me`.
  - Inside a group, sort by due date, then board order. Always show every window as a drop target.
  - A drag calls `POST /cards/:id/reschedule` with `to` = `today`, `next_7_days`, `later`, `none` or
    `done`. Later asks for a date first (it must be after the next 7 days, or `422`). Overdue is not
    a drop target.
  - Recompute windows when the next boundary passes and on every realtime `card.updated`.
  - `src/lib/due.ts`'s 48-hour pill may stay, but grouping uses `DueWindow`.
- **Drags in general:**
  - No reordering inside assignee or due groups; list grouping moves and reorders as today.
  - Optimistic updates roll back and show the API error on `422`, `402` or `403`.
  - Filtering still disables drag.
  - Keyboard dragging and focus return work in every grouping.
- **Guests (portal):** due grouping read-only, no assignee grouping (they never see assignees).

## 4. Done means

1. Lint, typecheck, unit tests (grouping and window logic with a pinned clock and a non-UTC
   timezone), and the production build all pass.
2. The e2e suite passes against the backend:
   `BACKEND_DIR=/home/chandan/Desktop/agency-mvp-clone PW_CHANNEL=chrome npm run test:e2e`.
   Add journeys for:
   - switching grouping keeps filters;
   - an assignee drag swaps the assignee;
   - a drag into Today sets today's date;
   - Later asks for a date;
   - a guest sees due grouping without drag;
   - plus the access-list checks from section 1.
3. Both themes and mobile widths are checked; previews are refreshed.
4. Docs are updated: [BOARD_VIEWS.md](../BOARD_VIEWS.md) for grouping, this handoff marked done, and
   [README.md](README.md) indexed.
5. **Commit and stop.**
   - Follow the repository's git rules: pull the branch first, put local changes on top without a
     merge commit, and use one-line commit subjects.
   - Make focused commits, for example: the teams integration already in the working tree, the
     access-list follow-up, the mobile Teams polish and tests, and board grouping.
   - Then stop and report what was committed and verified, and anything left. Do not push or open
     a PR.
