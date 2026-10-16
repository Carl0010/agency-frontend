# Sidebar and page responsibilities

Member routes (`/w/[slug]/*`) use two navigation levels: a **56px icon module
rail on the far left**, followed by the existing **256px contextual sidebar**.
A 56px app bar spans the full viewport above both levels.
The guest portal keeps its separate navigation and imports none of this shell.

## Ownership

| Surface | Responsibility | Contents |
| --- | --- | --- |
| Module rail | Switch high-level areas | Projects, Inbox with live unread count, Workspace |
| Sidebar identity | Identify workspace and selected module | Workspace name and current module label |
| App bar | Global actions and navigation visibility | Centered search palette trigger, hamburger, Agency home, labelled light/dark switch |
| Projects sidebar | Browse client work and project surfaces | Projects overview, import, project list, create button, per-project menu, current project's Board/Chat/internal Team |
| Inbox sidebar | Browse activity and configure delivery | All notifications and notification preferences |
| Workspace sidebar | Manage people, preferences and subscription | Members, notifications, owner-only billing |
| Sidebar footer | Resume setup, understand trial status, account actions | Setup progress, trial link, user identity/role, log out |
| Project/page header | Describe and act on the current view | Project title, sharing, collaborators, archive; page-specific primary actions |
| Content toolbars | Manipulate the current content | Kanban/List presentation, card filters, list selection, message/thread controls |
| Persistent content banners | Show urgent state and recovery actions | Read-only/payment warnings and exports; push permission explanation |

The module rail is global navigation. The neighboring sidebar shows only the
selected module's destinations. Do not duplicate all workspace settings inside
the Projects sidebar or repeat Board/Chat/Team tabs above content. Page actions
remain local: card creation, dragging, message composition, sharing and
destructive operations belong beside the content they affect.

## Module destinations

- **Projects** opens the projects overview. Project boards, cards, client Chat,
  internal Team, import and global search results belong to this module.
- **Inbox** opens workspace activity, retaining its live unread badge across
  all member screens. The sidebar's notification preferences link moves into
  the Workspace module because preferences live under workspace settings.
- **Workspace** opens Members. The contextual sidebar contains Members,
  Notifications and owner-only Billing; existing API permissions still apply.

Module selection comes from the current URL, including direct links, reloads
and browser history. It is not a second copy of router state or server data.

## Responsive behavior

- At 1024px and above, the 56px rail and 256px sidebar are adjacent and fill the
  remaining height below the app bar. The content begins after 312px of navigation.
  The hamburger collapses/reopens the 256px sidebar while retaining the module rail;
  the content gains that space. This visibility persists during member-route navigation.
- Each navigation area's middle scrolls independently. Workspace identity and
  account/status footer remain accessible. Long names truncate.
- Below 1024px, **Open navigation** opens one native modal drawer up to 320px
  wide. It contains the same 56px rail and a flexible contextual sidebar. Both
  navigation levels leave the board's normal mobile work area available when closed.
- The drawer contains keyboard focus and makes background content inert.
  Escape, close, backdrop click, selecting a destination and resizing to desktop
  close it. Route changes finish closing the old drawer before it can be reopened.
  Closing restores focus to the opener when it still exists.
- Module destinations close the mobile drawer just like other destinations;
  reopening shows the selected module's links. Search is in the app bar, never the sidebar.
  Ctrl/Cmd K from the drawer closes navigation before the palette opens. Rail entries have
  44px icon targets, accessible names, title tooltips and visible focus/selection states.
- Mobile still shows one board list at a time below 640px. Navigation does not
  replace that content control or alter drag-and-drop behavior.

## Active and unread states

The selected module uses `aria-current="location"` in the rail. Use
`aria-current="page"` for the selected destination in the contextual sidebar. The current project
parent uses `aria-current="location"` and expands its three destinations.
Card routes and additional boards retain Board as their selected destination.
Keep the Team link's lock icon and **Internal** label visible.

Project and channel unread dots are live. `WorkspaceShell` owns one
`useWorkspaceChannels` subscription and passes data into both navigation
presentations. Do not mount that mutating event subscription separately in
desktop/mobile lists, which would double-count incoming activity.
Creating a project and finishing an import invalidate both project and channel
queries, so the persistent sidebar discovers new destinations without a reload.

## Card inspector

Opening a member card from a board uses a non-modal right drawer in the board's
intercepted `@modal` route slot. The URL still identifies the card.

- At 768px and above, the board and drawer share the available work area. The
  drawer is 448px wide, 512px from 1280px, and 576px from 1536px. The board's
  lists remain horizontally scrollable beside it; there is no backdrop, page
  scroll lock or focus trap. Clicking another tile switches the inspector.
- Below 768px, the drawer fills the work area below workspace navigation.
  The board remains mounted but is hidden, including its covered keyboard
  controls, until the drawer closes. Workspace navigation remains available.
- The drawer owns card editing and an independent content scroll area. Its
  header keeps Close, Open card as full page, and desktop Focus board available.
  The selected tile has an expanded state and a visible outline.
- Opening focuses the drawer; closing returns focus to the selected tile when
  focus is still in the drawer. Navigation through the board must not have its
  focus stolen. Tab can leave the drawer normally. Escape inside the drawer
  closes it unless an inline editor or popover consumes the key. Board controls
  retain their own Escape behavior.
- Closing returns to the board with the current filters. Browser Back/Forward
  dismiss/reopen the inspector. Reloading or opening a direct card URL renders
  the existing full-page detail. Open card as full page explicitly bypasses
  route interception with a normal anchor.
- Card switches remount card-specific editors and reset inspector scrolling.
  Description drafts retain their existing per-card local-storage keys.
- A loading or unavailable card stays inside the drawer, with Close and the
  board still available. Existing API failures and permissions are preserved.

`components/card/card-drawer.tsx` owns inspector behavior and chrome.
`components/card/card-detail.tsx` owns card content, with compact drawer and
full-page layouts. Keep member drawer code outside the guest portal tree.

## Implementation

- `components/navigation/workspace-shell.tsx`: workspace data/subscription,
  adjacent navigation levels, responsive shell, global app bar and sidebar/drawer visibility.
- `components/navigation/module-rail.tsx`: high-level module links.
- `components/navigation/workspace-modules.ts`: module labels and URL classification.
- `components/navigation/workspace-sidebar.tsx`: navigation sections, current
  project destinations and account footer. Projects share the existing TanStack
  query key; loading, failure/retry and empty states are explicit.
- `components/navigation/navigation-drawer.tsx`: native modal lifecycle, focus,
  background scroll containment and viewport cleanup.
- `components/project-chrome.tsx`: local project actions only.

Keep server state in TanStack Query. Sidebar/drawer visibility and browser theme preference are local UI state.
Existing API authorization remains authoritative. Billing navigation and plan
details stay owner-only; do not infer extra permissions from visible links.

## Panel motion

The desktop sidebar and card inspector resize their reserved space with the shared
`--duration-panel` (220ms) and `--ease-ui` tokens. Their content keeps a stable
width while sliding, so text does not repeatedly wrap during the transition.
Rapid sidebar toggles reverse the current transition. Collapsed navigation is
inert and hidden from assistive technology immediately.

Mobile navigation uses native dialog display/overlay transitions for its slide
and backdrop fade. Closing releases modal focus and scroll containment without
waiting for the visual exit; this keeps the search shortcut responsive. Browsers
without discrete-transition support retain immediate native dismissal.

The board layout owns `CardDrawerHost`; the intercepted route registers the
current card with it. This retains the inspector through closing transitions,
including browser Back, without retaining a stale route tree. Exiting content is
inert and hidden from assistive technology; focus returns to the board at the
start of closing. Card switches update the open inspector without replaying its
entrance. Once its own width/slide transitions finish, card content unmounts.
Navigation away from the board disposes the entire inspector normally.

Reduced-motion preferences remove the visible travel in every panel. This panel
resize is the specific exception to the general rule against animating content
layout; do not add layout animations to board cards or unrelated page content.
`e2e/panel-motion.spec.ts` uses presentation fixtures to check intermediate sizes,
rapid reversal, history, focus, mobile search handoff and reduced motion. It does
not verify compatibility with the pending backend contract upgrade.

## Verification

`e2e/navigation.spec.ts` covers the exact 56px rail width, module switching,
contextual destination ownership, active states, local
sharing, mobile focus containment/restoration, dismissal, search handoff and
viewport changes. Existing guest, onboarding, chat and board journeys exercise
their unchanged workflows. `e2e/card-drawer.spec.ts` verifies board interaction,
card switching and drafts, filters, focus, mobile layout, history, direct links
and unavailable-card recovery. `portal-bundle.spec.ts` explicitly forbids the entire
member navigation directory in the guest portal's transitive import graph.

## Project actions

The Client projects heading has an Add project button and no outbound arrow;
the Projects overview link above already owns that destination. The current project
expands automatically without a decorative chevron. Its native creation dialog creates
through the existing API and navigates to the returned default board. A separate
menu beside each project contains Open board, Edit project and Copy project link;
it is never nested inside the project link. The editor supports project name,
optional client name and the eight server-defined colors. Create/edit failures
stay visible and preserve form input. The API decides authorization and billing.

Saved custom icons and per-user stars are not in the API yet. See
[the implementation handoff](handoffs/PROJECT_PERSONALIZATION.md). Do not add a
pretend Starred list or silently persist project settings only in the browser.

## Themes

The app bar displays Dark mode or Light mode as the action's target. Before-paint
initialization uses the saved preference, otherwise the OS preference. Explicit
choices persist across navigation/reloads and synchronize across tabs. Storage
failure still allows switching for the current page. Shared tokens theme all
routes, including auth and portal; member navigation remains excluded from portal.

## Board presentations

[Kanban and List](BOARD_VIEWS.md) share filters, card routes and API state.
The presentation switch belongs with board content, never in the app bar or
sidebar. Preserve `view=list` and filters when opening/closing card details.
