# One card in several projects

Status: implemented in the working tree; verification in progress 2026-10-30, with the card-scoped people reads from
[CARD_PLACEMENTS_PEOPLE_READS.md](CARD_PLACEMENTS_PEOPLE_READS.md), which resolved
[the contract blocker](CARD_PLACEMENTS_CONTRACT_BLOCKER.md). Written by the backend
session for the frontend session.
The backend is built and tested in `/home/chandan/Desktop/agency-mvp-clone` on `refactor/api-domains`
(all 262 unit and 374 integration tests pass). It is not committed yet: see "Working tree" below.
Do not change the backend. If the contract looks wrong or incomplete, stop and report it in a
handoff here instead of working around it in the client.

**How this session ends:** make focused commits, then **stop and report**. Do not push, do not open
a pull request; the user does that.

## Read first

- `/home/chandan/Desktop/agency-mvp-clone/docs/CARD_PLACEMENTS.md`: the design, its rules and the
  worked example (Website / Q4 Launch).
- `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/CHANGELOG.md`: the entry "One card in
  several projects".
- `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/openapi.yaml`:
  - paths `/cards/{id}/placements` (POST), `/cards/{id}/placements/{projectId}` (DELETE),
    `/cards/{id}/home` (PUT) and `/cards/{id}/transfer` (POST);
  - parameter `CardContext` (`?project=`) on every card route;
  - schemas `CardTileFields` (new `homeProjectId`, `key`, `placementCount`), `CardDetail`
    (`placements`), `CardPlacementView`, `PlaceCardRequest`, `ChangeCardHomeRequest`.
- `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/README.md`: realtime, the new
  `card.removed` event and the fan-out note.
- `/home/chandan/Desktop/agency-mvp-clone/docs/backend/LANGUAGE.md`: home project, placement, card
  access rule, place / remove, change home, transfer.

## What the API does now

- A card has one **home** project (owns its number) and one **placement** per project it is in
  (list and position there), at most 20. Title, description, due date, assignees, labels,
  checklists, attachments and comments are shared.
- Anyone who can see one of the card's projects sees the whole card. Guests only through live lists
  and boards, and never get `placements` or `placementCount`.
- Every tile is drawn in a placement: `projectId`, `boardId`, `listId`, `position` are that
  placement's. `homeProjectId` and `key` (the home project's key) are the card's.
- `?project=<projectId>` on card routes picks the placement responses are drawn in, when the caller
  can see the card there. It never grants access.

## To do

1. **Card references.** Draw `${card.key}-${card.number}` from the tile or detail everywhere (board
   tiles, list rows, grouped board, drawer, portal, drag overlays). Today the board passes
   `board.project.key`; on the Launch board that would show `LAUNCH-42` for `WEB-42`.
2. **Project context.** Send `?project=<current projectId>` on card requests made from a project's
   screens (detail, update, assignees, reschedule, labels, archive and restore, checklists,
   comments, attachments on a card). Moves need nothing extra: the target list decides.
3. **Card detail.** Open `GET /cards/:id?project=<URL projectId>`. If the response's `projectId`
   differs from the URL's (the person cannot see the card there), replace the URL with that project
   and `boardId`. Show `placements[]` as chips, home marked; a chip opens the same card in that
   project. Agency only.
4. **Add to project / Move to project.** From the card's menu:
   - pick a project the person can see, then a list on its board;
   - `POST /cards/:id/placements` or `POST /cards/:id/transfer` with `{ listId }`;
   - on `409` with `details.reason === 'guests_will_see'`, confirm: "N guests of that project will
     see this card and its comments", then resend with `exposeToGuests: true`;
   - on `409 already_in_project`, say so; on `422` (20 projects, archived card), show the message.
5. **Remove from project / Make home.** On a non-home placement chip: `DELETE
   /cards/:id/placements/:projectId` and `PUT /cards/:id/home { projectId }`. The home chip offers
   neither. After making a home, the key changes: refresh the card.
6. **Also in N projects.** On tiles where `placementCount > 1`, a small marker (agency only).
7. **Realtime.** Handle `card.removed { cardId, listId }`: drop the tile from the board. Treat a
   tile whose `projectId` is not the board's project as not for this board. `card.created` also
   arrives when a card is put on this board from another project.
8. **Board grouping and filters** work unchanged: assignee and due drags change the card for every
   project; list drags move only this board's placement.

## Done means

1. Lint, typecheck, unit tests and the production build pass.
2. The e2e suite passes against the backend:
   `BACKEND_DIR=/home/chandan/Desktop/agency-mvp-clone PW_CHANNEL=chrome npm run test:e2e`. Add journeys:
   - a card added to a second project shows on both boards with its home key;
   - adding to a project with guests asks first;
   - a move on one board leaves the other alone;
   - removing from a project, making another project home, and transferring;
   - a person who sees only the second project opens the card there from a notification.
3. Both themes and mobile widths are checked; previews are refreshed.
4. Docs updated (board and card docs in this repository), this handoff marked done, and
   [README.md](README.md) indexed.
5. **Commit and stop.** Follow the repository's git rules: pull first, local changes on top without
   a merge commit, one-line commit subjects, focused commits. Then report what was committed and
   verified, and anything left. Do not push or open a PR.

## Working tree

The backend working tree also holds the workspace URL migration (slugs to workspace ids) that was
made from the frontend side in the same files (notification and search URLs, the audience cookie,
billing links). The two are tested together but not committed yet; the user decides how they are
committed. Please do not edit backend files for this work.

## Frontend verification checkpoint (2026-10-30)

- The placement UI, contextual card routes and card-scoped people pickers are in
  the frontend working tree. Lint, typecheck and 174 unit tests pass.
- All six placement browser journeys pass against the current backend source,
  including the hidden-project assignee and mention case. A full browser run
  passed 69 of 72 checks; the three failures passed in a focused rerun after
  correcting two test assumptions and a transient API connection failure.
- The webpack production build passes. The default Turbopack build failed because
  a child process could not bind a port in this environment. Verify the default
  build and commit the scoped changes before marking this handoff complete.
