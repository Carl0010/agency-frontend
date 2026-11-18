# Project status

Status: backend built and tested 2026-10-21, in the uncommitted working tree of
`/home/chandan/Desktop/agency-mvp-clone` (branch `feat/workspace-uuid-urls`, together with the card
placement and workspace-URL work). Written by the backend session for the frontend session.
Frontend work: **implemented** 2026-10-21 (see "Frontend implementation" at the end).

Do not change the backend. If the contract looks wrong, stop and write a
`PROJECT_STATUS_CONTRACT_BLOCKER.md` handoff here.

Read first:

- Design: `/home/chandan/Desktop/agency-mvp-clone/docs/PROJECT_STATUS.md`
- Contract: `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/openapi.yaml`
  (`ProjectStatus`, `ProjectView`, `UpdateProjectRequest`, `CreateProjectRequest`, `listProjects`)
- Changelog entry "2026-10-21 — Project status" in
  `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/CHANGELOG.md`

## The idea in one paragraph

A project has a **status**: Planned, In progress, On hold (open) or Completed, Cancelled (closed).
It is separate from **archive**. Archive still hides a project; status says where the work is. A
completed project stays in normal views until someone archives it, and an archived project keeps
its status. Any status can follow any other. Guests never see status.

## The contract

```ts
type ProjectStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
```

| Where | Change |
| --- | --- |
| `ProjectView` (agency members) | New `status: ProjectStatus` and `statusChangedAt: string \| null` (null until the first change). Both **absent for guests**, like `teamIds`. |
| `PortalProjectView` | Unchanged. No status. |
| `POST /workspaces/:id/projects` | Optional `status`; defaults to `in_progress`. |
| `PATCH /projects/:id` | Optional `status`, alone or with `name`/`color`/`icon`. Returns the `ProjectView`. `403` guest, `402` lapsed workspace, `422` unknown value. Same status again is a no-op (`statusChangedAt` unchanged). |
| `GET /workspaces/:id/projects` | New `?status=a,b` (comma-separated). Combines with `archived`, `starred`, `team`. `422` for an unknown value. Guests get `[]`. |
| Archive / restore | Unchanged; the status survives both. |
| Realtime | **None.** No event fires on a status change. Invalidate/refetch your own caches after a write; other people see it on their next fetch. |

Treat an unknown `status` value as `in_progress` when rendering (same rule as unknown icons).

## What to build

### 1. Status display

A small status pill (dot + label) from your semantic tokens, readable in both themes and not relying
on colour alone (the label is always there). Suggested tone per status, adapt to existing tokens:

| Status | Label | Tone |
| --- | --- | --- |
| `planned` | Planned | neutral |
| `in_progress` | In progress | info / accent |
| `on_hold` | On hold | warning |
| `completed` | Completed | success |
| `cancelled` | Cancelled | muted |

Tooltip or secondary text from `statusChangedAt`: "Since 21 Oct" (omit when null).

### 2. Changing it

- **Project header** (board page): the pill is a menu button for agency members. Menu is a radio
  group of the five statuses, the current one checked. Selecting sends `PATCH { status }`.
  Pending state while saving; on failure revert and show the error (402 shows the existing
  billing/lapsed treatment). Read-only pill when the member cannot edit.
- **Project editor** (create and edit dialog, `projects/project-editor.tsx`): a Status field,
  default "In progress" on create, sent with the other fields.
- Keyboard: menu opens with Enter/Space, arrows move, Escape closes, focus returns to the button.
- Optional nice touch: after choosing Completed or Cancelled, a toast with an "Archive project"
  action that calls the existing archive route. Never archive automatically.

### 3. Lists and navigation

- **Projects screen**: show the pill on every project row. Add a segmented filter: **Open**
  (`?status=planned,in_progress,on_hold`, the default), **Completed** (`completed`),
  **Cancelled** (`cancelled`), **All** (no param). It combines with the existing team grouping and
  the separate archived view. Ask the API with `?status=`; do not fetch everything and filter
  the closed ones out locally.
- **Sidebar team groups**: list open projects only (`?status=planned,in_progress,on_hold`), so
  finished work leaves navigation without being archived. Show a small On hold / Planned marker
  where space allows.
- **Starred**: unchanged (all statuses). A starred closed project shows its pill, so it is clear
  why it is not in the team groups.
- A closed project opened directly (link, search, card) works normally, with its pill in the
  header. Nothing is read-only because of status.

### 4. Guests

Nothing. The portal, its switcher and guest project headers must not render a status, and guest
bundles should not import the status menu (keep the existing portal import-boundary check
passing).

## Acceptance criteria

1. A new project shows In progress; one created with Planned shows Planned.
2. An agency member changes the status from the header menu; it survives reload and another
   member sees it after refetch.
3. Completed and Cancelled projects leave the sidebar team groups and the Projects screen's
   default Open filter, and appear under their own filter and under All.
4. Archiving a Completed project and restoring it brings it back as Completed.
5. A guest never sees a status anywhere (portal, switcher, project header).
6. In a lapsed workspace the change fails with the existing 402 treatment and the pill reverts.
7. A failed save reverts the pill and shows the error; retry works.
8. Unknown status values render as In progress.

## Test plan

- Unit: status label/tone mapping including the unknown fallback; the Open filter builds
  `status=planned,in_progress,on_hold`.
- e2e against the real API (`BACKEND_DIR=../agency-mvp-clone`): criteria 1 to 7, desktop and
  mobile widths, keyboard use of the menu.
- Existing portal import-boundary and contrast checks still pass.

## Workflow

Work on the current frontend branch. Add this file to `docs/handoffs/README.md` with its state,
commit, and stop: no push and no PR. If you write a blocker, say exactly which response or rule
is wrong.

## Frontend implementation

Implemented 2026-10-21 against the contract above; no contract changes were needed.

- `src/lib/project-status.ts`: labels, tones, the unknown → In progress fallback, the Projects
  filter and its `status=` value, and "Since 21 Oct". Unit tests in `project-status.spec.ts`.
- `src/components/projects/project-status.tsx`: the read-only pill and the header menu (native
  popover, `menuitemradio` items, Enter/Space opens, arrows/Home/End move, Escape closes and
  returns focus). Optimistic update of `['project', id]`, reverted with a toast on failure; a 402
  also refreshes billing and workspace state so the existing read-only banner appears. A
  read-only workspace shows the plain pill. Guest code never imports this file.
- Board header shows the menu; the project editor has a Status field (In progress on create).
- Projects screen: a pill on every row and an Open / Completed / Cancelled / All filter in the
  URL (`?status=completed`, Open is the default and omitted), answered by the API's `?status=`.
- Sidebar: team groups and Other projects read `?status=planned,in_progress,on_hold`; Starred is
  unchanged and shows the pill for any status other than In progress.
- Not built: the optional "Archive project" toast action (the toast has no action slot and the
  web has no project archive control yet). No realtime: other members see changes on refetch.

Verification: lint, typecheck, 174 unit tests, production build, and the full e2e suite (72
checks, including the new `e2e/project-status.spec.ts` for criteria 1–4, 6 and 7 on desktop and
phone widths with keyboard use, and a no-status assertion in the guest portal journey for 5)
against the real API from `../agency-mvp-clone`.
