# Board views

Implemented: Kanban and List are two presentations of the same member board.
No new backend endpoints or business rules are required. Both read the existing
board query, use TanStack Query for server state and retain the server's list
and card ordering. The guest portal remains separate.

## Switching and navigation

A labelled Kanban/List control lives below the project header. The default is
Kanban; `?view=list` selects List. Changing the presentation preserves filters
and unrelated URL parameters, without scrolling the document. Filters keep the
view parameter. Reload, shareable URLs and browser history restore the selected
presentation. Unknown view values safely render Kanban.

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
below each list panel. Kanban columns fill the available board height; the
empty dashed outline fills their remaining card area rather than hugging its text.

Kanban lists drag from the whole header (including its title, count and padding),
with no separate grip. The title remains the keyboard activator: Space lifts,
arrows move, Space drops and Escape cancels. A normal title click renames;
ending a drag must not open rename. Menus and the rename field never activate
header dragging. Filtering keeps list/card sorting disabled as before. The List
presentation retains its collapse control and does not enable group dragging.

The board canvas uses a cool neutral `board-canvas` token in light and dark
mode; navigation keeps the warmer `background` token. Card and toolbar surfaces
retain their existing semantic roles.

## List layout

- Groups follow the board's lists, including empty lists. Headers show the list
  name, filtered/total count, collapse control and Rename/Archive actions.
- Rows show card key/title, assignees, due date, labels and activity. A native link
  opens the card drawer by click or Enter; selection is visible and announced.
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
  cards have distinct messages. List view does not offer drag sorting; use
  Kanban for dragging or the card drawer's List control to move a card.

## Existing API actions

`AddCard`, `AddList` and `ListHeader` are shared components under
`src/components/board/`. Card creation appends with `{ at: 'end' }`; the API
assigns positions. Creating/renaming lists updates the board cache from the
response; archiving refetches it. Failures are shown through existing API error
handling; failed creation preserves entered text for retry. Backend authorization
and subscription gates remain authoritative.

## Verification

`e2e/board-list-view.spec.ts` covers exact Add list dimensions, immediate creation, focused naming, failed creation/rename
and retry, URL restoration, shared filtering/order, row drawer interactions,
collapse/rename/archive, mobile creation, light/dark previews and overflow.
Existing Kanban drag, card drawer and onboarding journeys remain regression
coverage. Screenshots are indexed in `docs/previews/README.md`.

`e2e/list-header.spec.ts` covers canvas/sidebar separation in both themes, whole
header pointer dragging, title/menu editing, filtering, keyboard reordering and
failed reorder recovery. New canvas token pairs are contrast-tested in both themes.
