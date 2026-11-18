# Card placement contract blocker: card-scoped people reads

Status: resolved 2026-10-21. The API added `GET /cards/:id/assignable` and
`GET /cards/:id/mentionable` ([the answer](CARD_PLACEMENTS_PEOPLE_READS.md)); the
Ann/Bob case below is now a browser journey in `e2e/card-placements.spec.ts` that
passes against the local API. This record preserves the original finding.

## Why this stops the handoff

[CARD_PLACEMENTS.md](CARD_PLACEMENTS.md) requires: “If the contract looks wrong or
incomplete, stop and report it in a handoff here instead of working around it in
the client.” The backend design says assignees and mentions follow the **card
access rule** across all its placements, but its people-read contracts still
follow a single project's readers. There is no documented card-scoped assignable
or mentionable endpoint or `cardId` option on the existing roster read.

This affects the existing card drawer, inline List assignment, mentions and
assignee grouping when a card is in several projects. Do not replace these reads
with the whole workspace roster, or discover people by enumerating projects.

## Verified reproduction

Disposable local accounts and two projects, through the real API on port 4100:

1. Owner creates Website and Launch, with no team shares.
2. Ann is a member given `edit` on Website only. Bob is a member given `edit` on
   Launch only. The owner creates a card in Website and adds it to Launch.
3. As Ann, `GET /cards/:id?project=<Website>` succeeds; `placements` contains
   Website only. Launch is correctly absent because Ann cannot see it.
4. `GET /projects/<Website>/assignable` omits Bob.
5. `GET /workspaces/:id/members?mentionable=true&projectId=<Website>&surface=card`
   omits Bob too.
6. `GET /projects/<Launch>/assignable` as Ann returns `404`, as expected.
7. Nevertheless `POST /cards/:id/assignees/<Bob>?project=<Website>` returns `201`
   and a tile with Bob assigned: the write correctly uses all the card's projects.

Observed result:

```json
{
  "visiblePlacements": ["Website"],
  "bobInAssignableRead": false,
  "bobInMentionRead": false,
  "otherProjectRosterStatus": 404,
  "assignmentAccepted": true
}
```

The temporary reproduction script is `/tmp/card-roster-contract-check.cjs` on
this machine. It creates synthetic local accounts; it is not part of the app.

## Contract/source evidence

Backend repository: `/home/chandan/Desktop/agency-mvp-clone`.

- `docs/CARD_PLACEMENTS.md`, “Who sees a card”: assignees can see any one of a
  card's projects; mentions resolve against people who can see the card.
- `apps/api/contract/openapi.yaml`: `/projects/{projectId}/assignable` is explicitly
  project-scoped. The member roster parameters are `mentionable`, `projectId` and
  `surface`; there is no card context for people reads.
- `MembersController.list` in
  `apps/api/src/domains/tenancy/memberships/interface/members.controller.ts`
  accepts those same parameters.
- `KyselyMembershipQueries.list` restricts mention candidates with `project_reader`
  for one `projectId`. `KyselyTeamQueries.assignable` also uses one project's readers.
- `KyselyAssigneeEligibility.isAssignable` in cards infrastructure checks all the
  card's project IDs, so the demonstrated write succeeds correctly.

Sending an undocumented `cardId` query would not fix this: the member controller
has no handler for it. Unioning rosters from visible `placements[]` would miss Bob,
since Launch is intentionally hidden from Ann.

## Required backend decision/change

Publish an authoritative card-scoped candidate read before frontend integration.
For example, `GET /cards/:id/assignable` and `GET /cards/:id/mentionable`, or an
explicitly documented card-scoped extension to the existing people endpoint.
Finalize the exact paths/shapes with the backend owner; these are proposals.

- Authorize the card through `card_reader`, deriving workspace from authenticated
  scope. Never require the caller to see its home or every other placement.
- Assignment candidates: active workspace members who can see this card, with
  names/avatars/IDs sufficient for the picker. No guests or unnecessary emails.
- Mention candidates: use the API's mention rules and `GuestVisibility`; decide
  and document the guest audience explicitly. Do not expose hidden project metadata.
- Retain the separate project-level assignable read for board group headers.
  Decide how a board presents an assignee on a placed card when that assignee does
  not read this project; never silently drop an assigned card from grouping.
- Reads remain available when billing lapses. No access/cross-workspace requests
  return `404`. Keep query counts bounded.
- Update OpenAPI, the contract changelog and the frontend handoff in the same change.

Backend acceptance: the Ann/Bob scenario above can discover Bob from the card's
people API without revealing Launch; assignment and mention eligibility match
reads. Cover guest visibility, inactive/revoked people, removed placements,
cross-workspace IDs and lapsed billing.

## Frontend resumption

After that contract is available, implement the original handoff completely,
including home keys, placement-aware detail/query keys, add/transfer/remove/home
controls, guest exposure confirmation, realtime reconciliation and all requested
journeys/previews. Add a journey for the Ann/Bob candidate case as well.

The previous UUID URLs, persistent card views and skeletons were already verified
with lint, typecheck, 160 unit tests, a production build and all 64 browser checks.
They are now checkpointed in focused local commits `e12be87` (shared skeleton
foundations) and `d3395c1` (workspace/card navigation and adoption). The branch was
updated with `git pull --rebase`; the remote had no additional commits. Nothing
was pushed, and no pull request was opened.
