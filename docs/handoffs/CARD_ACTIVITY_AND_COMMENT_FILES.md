# Card activity feed and files on comments

Status: implemented 2026-11-26. The API side is `Carl0010/agency-mvp` #8 (migration 0019:
`GET /cards/{id}/activity` and `attachmentIds` on comments, as proposed below). The client uses the
activity route as its capability check: where it answers, the Activity tab shows the feed and the
comment box posts files with the comment (listed under it, removable before posting); where an older
API answers 404, both fall back to the behaviour described next.

## What the card details do now

- **Rich text.** Comments and the description use a formatting editor (TipTap, headless) that
  reads and writes the same Markdown string the API already stores. Bold `**`, italic `*`, strike
  `~~`, bulleted and numbered lists, quotes, inline code and links are standard Markdown. Underline
  is written as `<u>…</u>`; the renderer turns only that tag into an underline and still never
  renders other HTML. Mentions keep the `@[Name](user:<uuid>)` token, so the API's mention
  extraction is unchanged.
- **Description autosave.** Saves a second after typing stops and on blur through the existing
  `PATCH /cards/:id { description }`. A draft stays in `localStorage` until the save succeeds.
- **Images and files.** Images in the description and files on a comment upload through the
  existing card attachment flow (`POST /cards/:id/attachments`, presigned PUT, `complete`). The
  Markdown links to them as `attachment:<attachmentId>` (`![name](attachment:<id>)` for images,
  `[name](attachment:<id>)` for files); the client resolves each through
  `GET /attachments/:id/content?format=url` when shown or clicked. They are card attachments, so
  they also appear in the card's Attachments list and follow its access and guest rules.
- **Activity tab.** Built only from data the card read returns: who created the card and when,
  each uploaded attachment (`uploadedBy`, `createdAt`) and each comment. Nothing is invented or
  stored locally.

## Proposed: card activity feed

The Activity tab cannot show moves between lists, assignment, label, due date, title or
description changes, archive/restore or placements, because the API keeps no per-card history.

```
GET /cards/{id}/activity?project=<projectId>&cursor=<opaque>
200 { data: CardActivity[], nextCursor: string | null }

CardActivity {
  id: uuid
  at: date-time
  actor: PersonRef            // guests see actors redacted as for comments
  kind: 'created' | 'moved' | 'assigned' | 'unassigned' | 'labeled' | 'unlabeled'
      | 'due_set' | 'due_cleared' | 'due_completed' | 'renamed' | 'description_edited'
      | 'archived' | 'restored' | 'placed' | 'unplaced' | 'attachment_added' | 'attachment_deleted'
  data: object                // per kind, e.g. moved: { fromListName, toListName }
}
```

- Recorded from in-transaction subscribers to the existing card domain events (Conventions §3),
  not from controllers; ordinary edits stay out of `AuditService` (rule 10).
- Scope `@InProject` via the card reader (`card_reader`); guests receive only kinds visible on the
  portal, with assignee names removed (`guests/domain/redaction.ts`).
- Reads are never gated by subscription state.

Acceptance: moving, assigning and archiving a card each add one entry visible to members of every
project the card is in; a guest sees moves and attachments but no assignees; a lapsed workspace can
still read the feed.

## Proposed: attachments that belong to a comment

Today a comment's files are card attachments linked from its text. Deleting the comment leaves the
files on the card, and the files show in the card's Attachments list.

```
POST /cards/{id}/comments   { body, parentCommentId?, attachmentIds?: uuid[] }
CommentView                 + attachments: AttachmentView[]
```

- `attachmentIds` must be uploaded, clean attachments of the same card created by the author;
  linking moves them from the card's list to the comment.
- Deleting a comment soft-deletes its attachments (audited as attachment deletes, rule 10).
- Guests see a comment's attachments under the same rule as card attachments.

Acceptance: a comment posted with two files lists them under the comment and not in the card's
Attachments; deleting the comment removes both; `422 validation_failed` for another card's or
another author's attachment.

Until these exist the client keeps using the card attachment flow above. When they land, replace
the Activity tab's derived events with the feed and send `attachmentIds` from the comment box.
