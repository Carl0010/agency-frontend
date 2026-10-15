# Project icons and personal stars

Status: proposed; custom icons, star/unstar and the sidebar Starred section are
not implemented. Requested by the user on 2026-10-15. This handoff is intended
for another session. Do not replace shared project data with local storage.

## Existing capabilities

Frontend: `src/components/projects/project-editor.tsx`, `project-menu.tsx` and
`navigation/workspace-sidebar.tsx`. Sidebar creation, name/client/color editing,
Open board and Copy project link are implemented. A colored project marker uses
the existing project color. The Projects page also retains its create flow.

Backend on this machine: `../agency-mvp-clone` (API only). Read its AGENTS.md and
backend architecture/domain/conventions/language docs before changing it.
Current project DTOs accept name, optional clientName and color. Colors are
slate, red, orange, amber, green, teal, blue, violet. Existing contracts:

- POST `/workspaces/:workspaceId/projects` creates a project and default board.
- PATCH `/projects/:projectId` updates name, clientName (null clears) and color.
- GET workspace projects returns Project views without icons or personal stars.

There is no persisted icon field or per-user project-star API as inspected.
The contracts below are proposals to finalize with the backend owner.

## Proposed contract and model

1. Add `icon` to the project aggregate, persistence, create/update DTOs and member
   Project views. Default `folder` for existing rows. Use a closed allowlist:
   folder, board, briefcase, code, megaphone, pen, globe, rocket. Store identifiers,
   never SVG markup/HTML. The frontend maps identifiers to outline icons in
   `src/components/icon.tsx`; unknown values fall back to folder.
2. Reuse existing `color` for the icon background. Provide eight predefined
   accessible background variants with semantic content-color mappings for both
   themes. Do not generate arbitrary Tailwind class names from API values.
3. Store stars per authenticated user and project, never a global project boolean.
   Add a workspace-scoped relation with unique `(workspace_id, user_id, project_id)`
   and appropriate foreign keys/indexes. Use a forward-only migration and update
   Kysely schema by hand. Follow the projects module's domain/application/adapter
   shape and repository ports.
4. Proposed idempotent endpoints: PUT `/projects/:projectId/star` and DELETE the
   same path, with member project scope and user/workspace from authenticated
   scope. Never accept userId/workspaceId in a body. Guest requests are forbidden.
   Return `{ projectId, starredByMe }`. Add `starredByMe` to member Project views;
   never expose another user's preference. GET projects should include that flag
   in constant-query reads, without one query per project.
5. Decide explicitly whether personal preference writes remain available when
   billing lapses. Recommended: allow these personal preferences while the
   workspace remains readable, if consistent with product policy. Do not bypass
   existing entitlement guards without an explicit documented backend decision.
   Project metadata edits keep existing subscription gates.
6. Archived/inaccessible projects never appear in Starred. Revoked membership
   removes all access immediately. Decide whether archive preserves star rows
   for restoration; recommended preserve preference but filter archived projects.
   Guest portal may receive the safe icon identifier if needed, never starredByMe.

## Frontend behavior after the API lands

- Add Star/Unstar to the individual project popover. Explain the action with text
  and a star icon; do not use color alone. Show API errors. Update/invalidate
  TanStack Query state from server responses; rollback optimistic updates if used.
- Add a Starred section above Client projects, visible when the user has active
  starred projects. Entries open their boards and keep unread/active states.
  The regular project list remains complete. Use the same project row component.
- Provide the predefined icon picker and existing background/color picker in the
  project editor, plus a live preview. Name each radio option and preserve focus.
  Metadata is shared across workspace members; stars are personal.
- Keep Starred order deterministic using the API's documented ordering. Decide
  and document that order with the backend (suggest name then project ID).
- Query the authoritative full starred collection: the current project list is
  paginated, so do not show only stars in its first page. Either add a supported
  starred filter with cursor pagination or a dedicated scoped starred query.
- No project controls in guest navigation. No dead buttons/placeholders pending
  the backend; keep the existing supported editor working independently.

## Acceptance and verification

- Saved icon/color survives reload and appears for a second authorized member.
- Star survives reload for the current member; a second member has independent
  stars. Starred updates immediately after success and filters archived/revoked
  projects. Include a project beyond the first page in this test.
- Create/edit, invalid icon, cross-workspace access, guest access, lapsed billing,
  repeated PUT/DELETE, archive/restore and membership revocation are covered in
  backend domain/use-case/integration tests. Count queries for list/starred reads.
- Frontend journeys cover picker keyboard use, mobile drawer/editor interaction,
  star/unstar cache updates, failed API requests with retry, both themes, long
  project names and an empty Starred state.
- Run backend required checks in its repo. In this repo run lint, typecheck,
  unit tests, build and `BACKEND_DIR=../agency-mvp-clone PW_CHANNEL=chrome npm run test:e2e`.
- Work on branches; coordinate API contract before frontend integration. Open
  focused PRs. This document records remaining work, not permission to skip tests.
