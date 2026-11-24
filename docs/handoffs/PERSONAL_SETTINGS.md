# Your settings: Profile and Language

Status: Your settings shipped with Notifications and Appearance (2026-11-24). Profile and
Language show in its sidebar as disabled "Soon" items until the work below lands.

## Current capabilities

- **Your settings** (`/w/[workspaceId]/me/*`) opens from the account menu in the sidebar
  footer. It is the person's own settings, separate from Workspace settings.
- **Notifications** (`/me/notifications`): the per-workspace preference grid,
  `GET`/`PUT /notifications/preferences?workspaceId=`. `/settings/notifications` redirects here.
- **Appearance** (`/me/appearance`): Match system / Light / Dark. Theme is browser UI state
  (`src/lib/theme.ts`, key `agency:theme`), shared with the app bar switch.

## Profile: API ready, UI not built

`PATCH /me` (`UpdateProfileRequest`) already accepts `name` (1–200), `timezone` (≤ 64, IANA)
and `avatarUrl` (https URL). No backend work is needed for name and timezone.

Acceptance criteria:
- A form with name and a timezone `Combobox`, prefilled from the session user; save sends only
  changed fields, then updates the session (`setUser`) so the sidebar and menu show the new name.
- 422 shows field errors from `details`; other failures show `errorMessage` and keep the input.
- Avatar upload needs a decision first: the API takes a URL, not a file. Either reuse attachment
  storage for a presigned upload, or leave avatars to Google sign-in for now.

## Language: needs API support

No locale is stored on the user today, and the web has no translations.

Proposed contract:
- `users.locale text not null default 'en'` (migration plus `schema.ts`), exposed on `UserView`
  as `locale` and accepted by `UpdateProfileRequest` as one of the supported locales.
- Emails and push read the recipient's locale when they render.
- Add "Locale" to `docs/backend/LANGUAGE.md` in the same change.

Acceptance criteria:
- A `Select` of supported languages on `/me/language`; saving persists through `PATCH /me` and
  applies without a reload. Do not keep the choice in local storage.
- Only offer a language once its strings are translated.
