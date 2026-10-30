# Board views

Implemented: Kanban and List are two presentations of the same member board.
Both read the existing board query and use TanStack Query for server state.
List grouping retains the server's list and card ordering. Assignee and due-date
grouping use the published atomic-assignment and reschedule writes described
below. The guest portal remains separate.

## Grouping

The compact **Group by** switch offers List (default), Assignee and Due date in
both Kanban and List. `?group=list|assignee|due` composes with presentation, search
and structured filters, survives reload/history and travels into the card drawer.
Unknown values fall back to List. Switching grouping never changes stored lists,
positions or cards and never requires another board read.

- Assignee shows assignable people from `GET /projects/:id/assignable`, including
  empty groups, plus Unassigned. A card appears once per assignee, in board order
  (list order, then card position). Existing assignments remain visible even if a
  person is no longer assignable; that person's group cannot receive new drops.
  The same holds for a card placed from another project whose assignee cannot see
  this one: the group comes from the tile's `assignees` and is not a drop target.
- Due date always shows Overdue, Today, Next 7 days, Later, No due date and Done.
  It applies the API's `DueWindow` in the viewer's profile timezone from `/me`:
  completed first, then no date, overdue before now, today before the next local
  midnight, the following seven calendar days, and later. This differs from the
  existing 48-hour due pill and the elapsed-week filter. Cards sort by due date,
  with board order for ties. DST uses calendar boundaries, not 24-hour increments.
- A clock recomputes at due expiration, local midnight, tab visibility changes
  and board-cache changes from realtime `card.updated` events.
- These groups cannot be reordered. Card handles move between whole groups;
  dropping within the current group does nothing. List grouping retains existing
  card/list ordering. Filtering disables every drag, while row editors and links
  remain available. Lapsed workspaces cannot drag.
- Assignee drops call one atomic `PATCH /cards/:id/assignees` with `remove` for the
  source and `add` for the target. Unassigned omits the corresponding person;
  other assignees remain. Multiple occurrences use unique drag identifiers.
- Due drops call `POST /cards/:id/reschedule`. Today and Next 7 days are chosen
  by the server in the caller's timezone; None clears the date and Done completes
  it. Overdue is never a target. Later opens a labelled modal, retains the draft
  on failure and asks for a date after the next seven days. Date selection uses
  the profile timezone even if the browser uses another. Cancel makes no write.
- Writes preview optimistically in shared board/card caches, restore the card on
  API failure (including 422/402/403), show the error and refetch authoritative
  data. Keyboard Space lifts/drops, arrows follow displayed group order, Escape
  cancels. Successful drops expand collapsed destinations and return focus to
  the moved card's handle; cancellation/failure returns focus to its source.
- Guests get List and Due date only, with read-only tiles and no drag/assignee
  controls. Returning from a portal card preserves due grouping. The portal
  imports no member board or workspace navigation.

## Switching and navigation

A labelled Kanban/List control stays left in a compact toolbar, with search and
filter controls aligned right. The header shows the project's saved icon/color
and name, without card/list counts or client-description metadata. The default is
Kanban; `?view=list` selects List. Changing the presentation preserves filters
and unrelated URL parameters, without scrolling the document. Filters keep the
view parameter. Reload, shareable URLs and browser history restore the selected
presentation. Unknown view values safely render Kanban.

The card search placeholder is **Search by card name**. Filters open a native
anchored popover, with member names/avatars, label choices, due date, selected
counts and Reset/Done actions. Selection updates the same URL filters immediately.
The panel is non-modal and never expands the header or shifts board content.
It clamps to the viewport, repositions on resize/scroll and keeps long option
lists scrollable. Escape/outside click dismiss; Close/Done returns to the trigger.
Reset preserves card search; the toolbar Clear resets all filters. Reload restores
the selected filters with the panel closed. Filtering disables drag sorting in both views.
Client-only filter changes use Next's integrated History API and compose against
the latest URL, so quick selections accumulate without a server navigation per click.

Opening a card uses the existing non-modal drawer and carries the view/filter
query into the card URL. Closing returns to that same presentation; focus returns
to its card tile or row link. The drawer still supports editing and moving cards
through existing API behavior.

## Kanban dimensions

The Add list tile is 320px wide and 60px high: the column width and the shared
list header height. Clicking it creates a `New list` through the API, scrolls to the new column and
selects its inline name field. Enter or blur saves the name; Escape keeps the
already-created list with its saved name. There is no Add/Cancel mini-form.
Creation failure adds no column and leaves the tile available for retry; rename
failure retains the entered name for retry. The existing
one-list mobile Kanban layout is retained. Add card remains a separate tile
below each list panel. Kanban columns size to their content, capped by available
board height so long lists scroll internally. Empty dashed outlines have a 200px
minimum height; empty columns wrap that area instead of stretching to the viewport.

Kanban lists drag from the whole header (including its title, count and padding),
with no separate grip. The title remains the keyboard activator: Space lifts,
arrows move, Space drops and Escape cancels. A normal title click renames;
ending a drag must not open rename. Menus and the rename field never activate
header dragging. Pointer and keyboard list targeting both use the 60px header
rectangles, so different card counts do not affect the reorder target.
Filtering keeps list/card sorting disabled in both presentations. List uses
explicit hover/focus handles rather than the whole-header Kanban drag area.

The board canvas uses a lighter shade of the sidebar's warm neutral palette
through `board-canvas` in light and dark mode; navigation keeps `background`. Card and toolbar surfaces
retain their existing semantic roles.

## List layout

- One semantic table contains list section rows and card subrows, including empty
  lists. Section headers are 48px; desktop card rows are approximately 40px.
  Headers show the name, filtered/total count, collapse and Rename/Archive actions.
- Rows show card key/title, assignees, due date, labels and activity. The card key
  is a native link opening the drawer; its accessible name includes the full title.
  Clicking the title edits the name inline. Enter/blur saves, Escape cancels,
  and a failed save retains the draft with an error and retry. Assignee and due
  cells open non-modal editors, backed by the existing API and shared card cache.
  Assignees come from the project-scoped roster, never the whole workspace.
- Groups collapse independently. Table and composer controls are hidden from
  keyboard navigation while collapsed; expanding restores them.
- At a content width of at least 768px, metadata has labelled table columns.
  Below that width, metadata wraps underneath each card title. Container queries
  also adapt the rows when the desktop card drawer narrows the board pane.
- Mobile List shows all groups in one vertical scroll area. It does not use the
  mobile Kanban list picker. List/card creation is available within this view.
- Labels keep readable names beside their colored dots; no color-only statuses.
  Both themes use existing semantic tokens and 44px mobile touch targets.
- Shared filters apply across groups. Empty lists and groups with no matching
  cards have distinct messages. Hover/focus reveals explicit list/card drag
  handles; touch devices show them persistently. Space lifts/drops, arrows reorder
  and Escape cancels. Cards can move between lists through the same move API.
- Lifting an expanded list temporarily closes only that list. Drop, cancellation
  or a failed save restores its previous expansion state. Other lists retain
  their state. Failed moves restore the authoritative snapshot and show errors.
  Drag is disabled during filters and pending inline card writes.

## Cards in several projects

A card can be on the boards of several projects and stay one card
(`docs/CARD_PLACEMENTS.md` in the API repository). Its **home** project owns its
number; each project it is in has its own **placement**: a list and a position.

- References come from the tile, never the board: `${tile.key}-${tile.number}` on
  tiles, rows, groups, drag overlays, the archive bin, the drawer and the portal.
  The Launch board shows `WEB-42` for a card at home in Website.
- Card requests from a project's screens send `?project=<projectId>` (`cardPath` in
  `src/lib/cards.ts`): detail, edits, assignees, reschedule, labels, archive and
  restore, checklists, comments and attachments. Moves send nothing extra: the
  target list decides. The API draws the returned tile in that placement.
- The detail opens with the URL's project. When the person cannot see the card
  there, the API shows it in a project they can and the URL follows; the project
  layout does the same for a link into a project they cannot see at all. Detail
  caches are keyed by card and project (`['card', id, projectId]`).
- **Projects** in the drawer lists `placements[]`, home first and marked; each opens
  the card in that project. Other placements offer **Make home** (the key changes)
  and **Remove** (confirmed: that project's labels come off). Neither is offered,
  nor **Move to project**, to someone who cannot see the home.
- **Add to project** and **Move to project** pick a visible project, then a list on
  its board. `409 guests_will_see` asks before that project's guests see the card
  and its comments, then resends with `exposeToGuests: true`; `409
  already_in_project` and `422` show in the dialog. A move follows the card.
- Tiles and rows with `placementCount > 1` show an **Also in N** marker. Guests
  never receive the count, so the portal never shows it.
- Assignee pickers (drawer and List rows) read `GET /cards/:id/assignable`, and
  card mention autocomplete reads `GET /cards/:id/mentionable`: people who see the
  card through a project the viewer cannot see are offered without naming it.
  Board assignee groups still use the project's `GET /projects/:id/assignable`.
- Realtime: a tile for another board updates the card's shared fields where this
  board already shows it (`shareTile`), and an archived card leaves every board.
  `card.removed { cardId, listId }` drops the tile from the board with that list.
  `card.created` also arrives when a card is put on this board from elsewhere.

## Existing API actions

`AddCard`, `AddList` and `ListHeader` are shared components under
`src/components/board/`. Card creation appends with `{ at: 'end' }`; the API
assigns positions. Creating/renaming lists updates the board cache from the
response; archiving refetches it. Failures are shown through existing API error
handling; failed creation preserves entered text for retry. Backend authorization
and subscription gates remain authoritative.

## Verification

`e2e/board-grouping.spec.ts` covers URL/filter composition, reload/history,
atomic assignee swaps in both presentations, Today and Later drops, rejected
Overdue targets, failed-write rollback, collapsed destination focus, due expiration,
realtime updates and read-only guest grouping. Captures wait for the selected
presentation and error-toast dismissal; the mobile grouped List preview asserts
that the table is visible. Grouping and timezone unit checks pin the clock and
cover non-UTC midnight and daylight saving boundaries.

`e2e/board-filters.spec.ts` covers right alignment, stable board height, combined
filter selection/reset, keyboard focus and dismissal, reload, both views, mobile
resize/overflow and saved project icons with unknown-identifier fallback.

`e2e/board-list-view.spec.ts` covers compact toolbar/header height, the 200px empty area,
exact Add list dimensions, immediate creation, focused naming, failed creation/rename
and retry, URL restoration, shared filtering/order, row drawer interactions,
collapse/rename/archive, mobile creation, light/dark previews and overflow.
Existing Kanban drag, card drawer and onboarding journeys remain regression
coverage. Screenshots are indexed in `docs/previews/README.md`.

`e2e/list-editing.spec.ts` covers the single table, inline name/assignment/date
editing and retry, card cache/drawer synchronization, hover/touch handles,
cross-list moves, section collapse restoration, failed reorder rollback,
mobile editors and both themes. Hidden desktop metadata never reserves mobile
table columns; the visible Card column owns the full narrow-table width.

`e2e/list-header.spec.ts` covers canvas/sidebar separation in both themes, whole
header pointer dragging, title/menu editing, filtering, keyboard reordering and
failed reorder recovery. New canvas token pairs are contrast-tested in both themes.
