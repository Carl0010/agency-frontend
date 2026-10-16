# Project icons and personal stars

Status: implemented on `feat/teams-project-access`, updated 2026-10-16. This
document records the completed frontend integration, replacing the original API
proposal. Verification and release status are recorded in the checkpoint below.

Release is paused at [the project access contract checkpoint](ACCESS_CONTRACT_BLOCKER.md).
The implementation is saved in a local checkpoint commit; no new PR has been opened yet.

## Saved project metadata

`projects/project-editor.tsx` supports the name, eight predefined colors and an
accessible radio picker for folder, board, briefcase, code, megaphone, pen, globe
and rocket, with a live icon/color preview. Create and PATCH requests persist
identifiers through the API; no project metadata is stored in local storage.
The removed `clientName` field is neither rendered nor sent.

`projects/project-icon.tsx` maps the allowlist to outline icons and safe semantic
backgrounds in both themes. Unknown identifiers fall back to folder. The same
renderer appears in member navigation, Projects, board headers and the portal.
The scoped project query supplies member access; board responses now also carry
their saved icon.

## Personal stars

`projects/project-star.tsx` adds Star/Unstar to the project menu, with labelled
actions, pending state and visible API failures. PUT/DELETE
`/projects/:projectId/star` returns `{ projectId, starredByMe }`; successful writes
update cached flags and invalidate project collections. No global project star
or local-storage preference is invented.

`WorkspaceShell` reads the authoritative `?starred=true` collection once for both
navigation presentations. Starred appears above team groups only when nonempty.
The API supplies the complete ordered collection (`nextCursor: null`,
case-insensitive name then ID); it is not derived from a selected team's subset.
Regular project navigation remains complete. Access changes clear and refetch
these collections. Guests import neither star controls nor member navigation.

The contract allows personal-star writes when billing lapses. Archiving preserves
stars but excludes the project from Starred until restoration; inaccessible
projects are excluded by the API. Project metadata still follows write gates.

## Verification

- `e2e/project-menu.spec.ts`: create/edit icon and color, failed saves with retry,
  reload persistence, keyboard/native picker use and mobile editor behavior.
- `e2e/project-access.spec.ts`: personal Starred collection, independent member
  preferences, reload, team grouping and live removal of revoked projects.
- `e2e/board-filters.spec.ts`: saved and unknown project icon rendering.
- Contrast and portal import-boundary checks run with the unit suite.
- Full frontend checks: lint, typecheck, unit tests, build, and real-API journeys
  with `BACKEND_DIR=../agency-mvp-clone PW_CHANNEL=chrome npm run test:e2e`.

The API and its authorization tests remain owned by `../agency-mvp-clone`.
See [the contract integration](BACKEND_CONTRACT_UPGRADE.md) for team sharing,
project access levels, invitations and realtime behavior.
