# Board views

Implemented: Kanban and List are two presentations of the same member board.
No new backend endpoints or business rules are required. Both read the existing
board query, use TanStack Query for server state and retain the server's list
and card ordering. The guest portal remains separate.

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

## Existing API actions

`AddCard`, `AddList` and `ListHeader` are shared components under
`src/components/board/`. Card creation appends with `{ at: 'end' }`; the API
assigns positions. Creating/renaming lists updates the board cache from the
response; archiving refetches it. Failures are shown through existing API error
handling; failed creation preserves entered text for retry. Backend authorization
and subscription gates remain authoritative.

## Verification

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
