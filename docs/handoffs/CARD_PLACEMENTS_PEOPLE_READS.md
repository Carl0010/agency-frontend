# Card placements: card-scoped people reads (blocker answer)

Status: done 2026-10-21. The client reads both routes (see the implementation record in
[CARD_PLACEMENTS.md](CARD_PLACEMENTS.md)). The backend change was built and tested in the uncommitted working tree of
`/home/chandan/Desktop/agency-mvp-clone` (branch `feat/workspace-uuid-urls`, together with the
placement and workspace-URL work). It answers
[CARD_PLACEMENTS_CONTRACT_BLOCKER.md](CARD_PLACEMENTS_CONTRACT_BLOCKER.md). Written by the backend
session for the frontend session. Resume [CARD_PLACEMENTS.md](CARD_PLACEMENTS.md) with the additions
below.

Do not change the backend. If the contract still looks wrong, stop and write a handoff here again.

## The contract

Two new reads, both `{ data: CardPersonView[], nextCursor: null }`, where `CardPersonView` is
`{ userId, name, avatarUrl }`, sorted by name. No emails or roles, and no project is named. Both take
the usual optional `?project=` (it changes nothing in the response). Neither is gated by billing.

| Route | Who may call | Returns |
| --- | --- | --- |
| `GET /cards/:id/assignable` | agency members who can see the card | Active agency members who can see one of the card's projects, including projects the caller cannot see. Exactly the people `POST /cards/:id/assignees/:userId` and `PATCH /cards/:id/assignees` accept. A guest gets `404`. |
| `GET /cards/:id/mentionable` | anyone who can see the card, guests too | Agency caller: everyone active who can see the card, its guests included. Guest caller: only the people among them the guest may know exist (people who posted where they can read, their teams' people, themself). Exactly whom a mention in the card's description or a comment resolves to. |

Anyone who cannot see the card, a card in another workspace or an unknown id gets `404`.

Sources: `/home/chandan/Desktop/agency-mvp-clone/apps/api/contract/openapi.yaml`
(`listCardAssignable`, `listCardMentionable`, schema `CardPersonView`, and the updated descriptions of
`listAssignable` and `listMembers`); the CHANGELOG entry "One card in several projects"
(`apps/api/contract/CHANGELOG.md`); `docs/CARD_PLACEMENTS.md`, "Who sees a card".

The blocker's scenario: Ana sees the card in Website only and Mia in Launch only. Ana's
`GET /cards/:id/assignable` and `/mentionable` include Mia, and the response does not contain
Launch's id or name. When the card leaves Launch, Mia drops out of both.

## What to change in the client

1. **Card assignee picker** (drawer, inline List assignment, anywhere a card's assignees are picked):
   read `GET /cards/:id/assignable`. Key it by card id, and invalidate it when the card's placements
   change (place, remove, transfer, change home, `card.removed`) and on membership or sharing changes
   you already react to.
2. **Mentions on a card** (description and comments): read `GET /cards/:id/mentionable` instead of
   `/workspaces/:id/members?mentionable=true&projectId=…&surface=card`. Channels keep the members
   read with `surface=shared|internal`. `MentionScope` (`src/lib/mention-scope.tsx`) has no card id
   today and `mentionableQuery` only builds the members query string. One way: give the card
   surface a `cardId` and have the scope produce the whole URL.
3. **Board assignee groups** keep `GET /projects/:id/assignable` as the drop targets. An assignee who
   cannot see the board's project is still on the tile's `assignees` (name and avatar), so their
   group shows with the card in it but is not a drop target. `boardGroups` already does this
   (`target: false`); keep it, and do not drop such cards from grouping.
4. Add the journey the blocker asked for: a person who sees the card in one project assigns and
   mentions someone who sees it only in another, without that project appearing anywhere in the UI.

Everything else in [CARD_PLACEMENTS.md](CARD_PLACEMENTS.md) is unchanged: do the whole handoff.

## Backend verification

`npm run lint`, `npm run typecheck`, 262 unit tests and 378 integration tests pass. New tests in
`apps/api/test/card-placements.int-spec.ts`, "the card's people pickers": the Ana/Mia case with the
hidden project absent from the payload, reads matching what assignment and mention accept, removed
placements, guests (mentionable but never assignable, a guest's own narrowed list, no `email` or
`role` keys), deactivated people, `404` for people who cannot see the card and for other workspaces,
a lapsed workspace, and a constant query count as readers grow.

## How this session ends

Same as [CARD_PLACEMENTS.md](CARD_PLACEMENTS.md): mark the blocker resolved and this file done, index
both in [README.md](README.md), make focused commits, then stop and report. Do not push or open a pull
request.
