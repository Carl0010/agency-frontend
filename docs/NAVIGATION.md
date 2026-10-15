# Sidebar and page responsibilities

The member workspace has one persistent left sidebar, shared across `/w/[slug]/*`.
It replaces the previous workspace top navigation and page-specific project rail.
The guest portal retains its separate navigation and imports none of this shell.

## Ownership

| Surface | Responsibility | Contents |
| --- | --- | --- |
| Sidebar identity | Which workspace am I in? | Workspace name and brand; link to projects |
| Sidebar quick access | Find work and see activity | Search palette and live inbox count |
| Sidebar workspace destinations | Move between workspace areas | Projects overview and import |
| Sidebar client projects | Switch projects and their work surfaces | Project list and unread dots; current project's Board, Chat and internal Team links |
| Sidebar workspace settings | Manage the workspace and personal preferences | Members, notifications, owner-only billing |
| Sidebar footer | Resume setup, understand trial status, account actions | Setup progress, trial link, user identity/role, log out |
| Compact app header | Location and mobile navigation access | Breadcrumb/location text and mobile menu button |
| Project/page header | Describe and act on the current view | Project title, sharing, collaborators, archive; page-specific primary actions |
| Content toolbars | Manipulate the current content | Card filters, list selection, message/thread controls |
| Persistent content banners | Show urgent state and recovery actions | Read-only/payment warnings and exports; push permission explanation |

Navigation answers where to go. Page actions answer what to do here. Do not
move card creation, drag controls, message composition or destructive operations
into the sidebar. Do not recreate Board/Chat/Team tabs above member content.
Sharing remains an action beside the project title. Import is available in the
sidebar and may remain a contextual shortcut on the projects overview.

## Responsive behavior

- At 1024px and above, the sidebar is 256px wide and fills the viewport height.
- Its middle scrolls independently; workspace identity and account/status footer
  stay accessible. Long workspace and project names truncate instead of widening it.
- Below 1024px, the compact header exposes **Open navigation**. The sidebar
  appears in a native modal drawer up to 320px wide with space for the backdrop.
- The native dialog contains keyboard focus and makes the rest of the app inert.
  Escape, the close button, backdrop click, selecting a destination and resizing
  to desktop close it. Closing restores focus to the opener when it still exists.
- Search closes the navigation modal before opening the search palette.
- Mobile still shows one board list at a time below 640px. The sidebar does not
  replace that content control or alter drag-and-drop behavior.

## Active and unread states

Use `aria-current="page"` for the selected destination. The current project
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
  responsive shell, location header and modal visibility.
- `components/navigation/workspace-sidebar.tsx`: navigation sections, current
  project destinations and account footer. Projects share the existing TanStack
  query key; loading, failure/retry and empty states are explicit.
- `components/navigation/navigation-drawer.tsx`: native modal lifecycle, focus,
  background scroll containment and viewport cleanup.
- `components/project-chrome.tsx`: local project actions only.

Keep server state in TanStack Query. Only drawer visibility is local UI state.
Existing API authorization remains authoritative. Billing navigation and plan
details stay owner-only; do not infer extra permissions from visible links.

## Verification

`e2e/navigation.spec.ts` covers destination ownership, active states, local
sharing, mobile focus containment/restoration, dismissal, search handoff and
viewport changes. Existing guest, onboarding, chat and board journeys exercise
their unchanged workflows. `e2e/card-drawer.spec.ts` verifies board interaction,
card switching and drafts, filters, focus, mobile layout, history, direct links
and unavailable-card recovery. `portal-bundle.spec.ts` explicitly forbids the entire
member navigation directory in the guest portal's transitive import graph.
