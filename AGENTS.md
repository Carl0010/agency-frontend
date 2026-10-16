<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend design system

Before changing UI, read [the design system](docs/DESIGN_SYSTEM.md).
For navigation changes also read [sidebar responsibilities](docs/NAVIGATION.md).

- `src/styles/tokens.css` owns colors, type sizes, radii and shadows.
- `src/app/globals.css` owns global focus, controls, motion and touch-target behavior.
- `src/components/ui.tsx` owns shared controls, badges, panels, headings and empty states.
- `src/components/icon.tsx` owns decorative outline icons and the brand mark.
- `src/lib/content-colors.ts` owns mappings for user-selected labels, projects and avatars.
- Use semantic color utilities. `design-system/semantic-colors` is an ESLint error.
- Keep business logic, API behavior and audience boundaries separate from visual changes.
- The 56px icon module rail owns Projects, Inbox and Workspace selection. The 256px
  contextual sidebar owns the selected module's links, project menus and account controls.
  The top app bar owns centered global search, sidebar visibility and a labelled theme switch.
  Page headers own local actions. Do not duplicate a project rail or member tabs.
- Member card details use a non-modal right drawer. Keep desktop board controls
  active; do not add a blocking backdrop, focus trap or document scroll lock.
- Board presentations follow [docs/BOARD_VIEWS.md](docs/BOARD_VIEWS.md). Keep view/filter
  state in the URL and server ordering unchanged; reuse the shared list header and composers.
- Use `useConfirm` from `components/confirmation.tsx` for confirmations. Browser
  confirm/alert/prompt calls are lint errors; preserve API authorization and error handling.
- A new token needs a purpose and documented foreground/background pairing. Run the contrast tests.
- Light and dark modes are supported. Define paired semantic tokens and verify contrast in both.
  Theme preference is browser UI state; project settings and stars must come from the API.
- When a requested feature lacks API support, add a Markdown handoff under `docs/handoffs/`
  with current capabilities, proposed contracts, acceptance criteria and implementation status.
  Implement supported UI independently; do not fake missing server state in local storage.
- Do not add component-library dependencies or duplicate button/input variants for a single screen.
- Preserve the generated Next.js instructions above.

## Working in this repository

This is the web client of Agency (Next.js App Router, Tailwind v4, TanStack Query). The API, the
database and every business rule live in the backend repository, `Carl0010/agency-mvp`. The web
is never the source of truth.

- Call the API through `src/lib/api.ts` only. Server state lives in TanStack Query; do not copy it
  into component state. Show API failures; do not swallow them. Branch on error `code`, never on
  message text.
- Guests see `/portal/*` only and agency members see `/w/*` only (`src/proxy.ts`). Hiding a button
  is not access control: the API enforces it. Never render data for one audience in the other's tree.
- Words in the UI follow the backend's ubiquitous language (`docs/backend/LANGUAGE.md` in the
  backend repository): project, card, list, guest, archive, and so on.
- Tests, in the same change: pure logic in `src/**/*.spec.ts` (`npm test`); user journeys in
  `e2e/*.spec.ts` (`npm run test:e2e`) only when a flow changes.
- Before you push: `npm run lint && npm run typecheck && npm test && npm run build`.
- Work on a branch and open a pull request to `main`. Small commits with a one-line subject.

