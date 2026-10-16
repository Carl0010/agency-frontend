# Backend contract upgrade: teams and project access

Status: implemented on `feat/teams-project-access`, 2026-10-16. The user confirmed
the backend is finished, tested and migrated. Frontend implementation follows
`../agency-mvp-clone/apps/api/contract/CHANGELOG.md` (2026-10-16), `openapi.yaml`,
the realtime README and `docs/backend/LANGUAGE.md`. Backend source is unchanged.
Verification and remaining work are recorded in the release checkpoint below.

Release checkpoint: [the access response mismatch](ACCESS_CONTRACT_BLOCKER.md)
was confirmed during final review. Work is saved in a local checkpoint commit; no new PR has
been opened. The listed checks passed, but this discrepancy requires a backend
contract decision before shipping. The blocker also records remaining visual QA.

## Implemented

- Removed `clientName` from requests and member/portal response types, creation,
  onboarding, editing and headers. Shared replaces the former channel kind and
  label; mention surfaces use `shared`. Notifications use `fromGuest`.
- Member project models carry `teamIds`, `access` and `starredByMe`. Portal
  models remain separate: no member access levels, stars, teamIds or assignees.
- A project layout checks the scoped project before rendering member content.
  Missing/revoked resources show “You don't have access to this project” and a
  return path. API errors remain visible; transient failures can be retried.
- Realtime access changes clear sensitive project caches, refresh the audience
  cookie and refetch authoritative state. Reconnects rejoin rooms and refetch
  without discarding unrelated form drafts. Denied joins clear stale project
  content. Revoked projects disappear from open surfaces and sidebar collections.
- New grants appear on fresh reads. The contract guarantees narrowing events,
  not events for new grants; the empty Projects state provides Refresh projects.
- Creation and member invites, including onboarding, have team selection.
  Defaults are the caller's active teams, otherwise Everyone where present.
  No-team sharing is explained explicitly. New workspaces need not have an
  Everyone team: migration created it for existing workspaces only.
- Workspace → Teams supports list/create, rename, archive/restore, adding active
  or invited people, team roles, guest access, remove/leave and guest invitations.
  Last-admin controls are omitted with a visible explanation; guests cannot
  become team admins. Archived teams remain readable and cannot be edited.
- Project admins get Share: team sharing, direct member edit/admin grants and
  direct guest invitations/access/revocation. Plain members see none of these
  mutation controls. Workspace owners/admins have implicit access and are not
  offered redundant direct grants. The API remains authoritative.
- Navigation groups projects by team, retains other/direct projects and shows
  the full personal Starred collection. Saved icons and their picker are complete;
  see [project personalization](PROJECT_PERSONALIZATION.md).
- Board filters, List row editors, card drawer assignees and mention pickers use
  project-scoped people. Guests are excluded from assignment, while mentions
  follow the API's audience/surface rules. Existing saved assignees stay visible.
- New writes follow the existing published billing flags/status gates. Reads and
  personal stars remain available when billing lapses. Server failures retain
  form input and are shown; no server state is faked in browser storage.

## Types and verification

`src/lib/types.ts` remains hand-maintained, aligned with the named OpenAPI
schemas. Member-specific `Project` narrows access to edit/admin; `PortalProject`
retains guest read/comment access. No type-generation dependency was introduced.

`e2e/project-access.spec.ts` covers empty membership, friendly direct-link 404,
team grant and fresh reads, scoped assignment, personal stars, plain-member
controls, live unsharing, team-admin guest invitations with default comment,
guest project isolation, last-admin behavior, rename/archive/restore, failed
creation retry, desktop light and mobile light/dark layouts.

Existing onboarding, guest, chat, project-editor, board and drawer journeys use
the new contract. The preserved List-table work is verified against this API,
including inline edits and section/card drag recovery. Unit checks cover team
defaults, contrast and the portal's transitive import boundary.

Run lint, typecheck, unit tests, build, and
`BACKEND_DIR=../agency-mvp-clone PW_CHANNEL=chrome npm run test:e2e` before release.
