# Teams and Projects lists

Status: frontend implemented 2026-11-26 with the APIs that exist. Two reads are per row today, and
Team chat waits on the API.

## What the screens do

- **Teams** (`/teams`, and Admin console → Teams): a table of teams. Search matches the team name or
  any member's name or email; a people filter (Quiet Pro `MultiCombobox` over the workspace roster)
  keeps teams that include every chosen person. Each row shows the people as an avatar stack (four,
  then `+N`) and a names sentence. Hovering, focusing or tapping an avatar opens a person card:
  larger avatar, name, email, and the Guest chip for guests. No actions, no shared-project counts.
- **Team page**: Overview (cover, Projects card, Members card), Members, Team chat (Soon), Settings
  for managers.
- **Projects** (`/projects`): a table of name, people, status and the project menu. Search by name
  (`?q=`), the status filter kept for the Open default (`?status=`), and `?team=` from the sidebar's
  team headings as a removable chip. The team dropdown and status pills are gone; no "Starred" or
  similar labels.

## Reads used

| Need | Read | Notes |
| --- | --- | --- |
| Teams | `GET /workspaces/:id/teams` | `TeamView` has `memberCount`, no people |
| A team's people | `GET /teams/:id` per row | Shared cache key `['team', id]` with the team page |
| Emails | `GET /workspaces/:id/members` | Agency members only; joined by `userId` |
| A project's people | `GET /projects/:id/assignable` per row | Active agency members who see the project |

## Proposed contracts (not implemented)

1. **People on the team list.** `GET /workspaces/:id/teams?include=people` adds
   `people: { userId, name, avatarUrl, guest }[]` (active and invited, by role then name) to each
   `TeamView`, in a constant number of queries. Guests calling it get the same redaction as
   `TeamDetailView`. Replaces the per-row `GET /teams/:id`.
2. **People on the project list.** `GET /workspaces/:id/projects?include=people` adds the
   `assignable` people to each `ProjectView` (agency members only; absent for guests). Replaces the
   per-row `GET /projects/:id/assignable`.
3. **Team chat.** A channel per team (`kind: 'team'`), readable by the team's members, with the same
   message, read-state and realtime contract as project channels; `GET /teams/:id/channel`. Until then
   the tab shows "Soon" and is not a link.

## Acceptance

- Team rows render while people load (placeholder avatars), and a failed team read falls back to
  the member count.
- The people filter never shows a team before its people are known.
- Avatars are buttons above the row's stretched link; Escape, scrolling, or a tap elsewhere closes
  the card.
- e2e: `e2e/teams-and-projects-lists.spec.ts`; unit: `src/lib/teams.spec.ts`, `src/lib/names.spec.ts`.
