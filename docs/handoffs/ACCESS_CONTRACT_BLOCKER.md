# Project access response: contract mismatch

Status: confirmed 2026-10-16; frontend release paused under the user's explicit
instruction: “If the contract seems wrong or missing something, stop and report
it instead of working around it in the client.” Backend source was not changed.

## Expected

The backend's 2026-10-16 contract changelog says that
`GET /projects/:projectId/access` returns directly granted members and that
workspace owners/admins are not listed because they always have access.
OpenAPI's `ProjectAccessView.members` description also says owners/admins see
projects without being listed.

## Observed

A fresh disposable signup, followed by project creation with `{ name, teamIds: [] }`,
returns this shape from the access endpoint (identifiers and names omitted):

```json
{
  "teams": [],
  "members": [{ "role": "owner", "access": "admin" }]
}
```

The caller's workspace role is owner. This is a fresh API reproduction, not a
frontend cache or an old migration artifact. The Share dialog consequently shows
the workspace owner with an editable access selector and Remove action, while
also explaining that workspace owners always have access.

The backend read at
`apps/api/src/domains/tenancy/memberships/infrastructure/kysely-team.queries.ts`
(`projectAccess`, lines 65–80 as inspected) excludes guests but does not exclude
owner/admin memberships. The frontend does not silently filter the response to
hide this discrepancy.

## Resolution needed from the backend owner

Either return the documented collection without workspace owners/admins, or
explicitly revise the contract and define the UI semantics of editing/removing
their stored direct grants when implicit admin access remains. Cover a project
created by an owner and a member subsequently promoted to workspace admin.
Do not change the frontend's authorization or grant representation as a workaround.

## Frontend state to resume

- Branch: `feat/teams-project-access`, based on the existing board/panel work in
  PR #4. Integration changes are saved in a local checkpoint commit; no new PR was opened.
- Implemented: removed client-name fields, Shared channels, team-aware creation
  and invites, Teams settings, project sharing/guests, project-scoped people,
  no-access states, realtime revocation, saved icons/picker, personal stars and
  team/Starred navigation. The previously pending editable List table is retained.
- Passed: lint, typecheck, 138 unit tests, production build and all 52 browser
  checks with `BACKEND_DIR=/home/chandan/Desktop/agency-mvp-clone PW_CHANNEL=chrome`.
  Four browser checks use presentation fixtures for panel motion; access journeys
  use the real API. Those checks do not assert exclusion of implicit workspace admins.
- Visual review caught one remaining frontend polish item: on narrow Teams
  screens, stack row identity and role/remove controls so names stay readable;
  give the Add workspace person selector its own full-width row. The current
  overflow test passes but does not detect those truncated controls.
- Remaining verification: add explicit unstar/failure-retry acceptance coverage,
  recheck the mobile Teams polish and save refreshed previews. Whitespace warnings
  were cleaned before the checkpoint commit. Resume in follow-up commits, then
  push, open the PR to main and check CI.
- Existing `feat/compact-board-layout` / PR #4 remains unchanged by this branch.
