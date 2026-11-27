# Agency design system

Accepted direction, 2026-11-18: **Quiet Pro**, a calm, dense, keyboard-first workspace
for teams. Cool near-neutral surfaces, one teal accent, Geist type, and
clear boundaries between navigation, work content and guest communication.
Dark mode is designed first and light mode is equally supported. The palette is
Agency's own; it does not copy a product's branding.

Quiet Pro is its own package, `@carl0010/quiet-pro`, from the private repository
`Carl0010/design-system`. That repository holds the tokens (OKLCH, both themes), the
shared React pickers and toggles, the brand book and the docs website. Agency installs it
from `vendor/` (an `npm pack` file, so CI and deploys need no access to that repository) and
updates it with `npm run quiet-pro:update -- <tag-or-commit>`.

This file is the source of truth for how Quiet Pro applies in this repository:

- **Palette.** In `src/styles/tokens.css`, a semantic token set to `var(--…)` follows Quiet Pro
  in both themes (`--color-primary: var(--accent)`). A hex value is an Agency-only role: board
  canvas, `muted`, fills with white text, info, highlight, and content colours.
- **Layers.** `globals.css` loads Quiet Pro's tokens in the lowest CSS layer, so Agency's own
  radius, shadow and font scale win where names collide, and its component styles in the
  `components` layer, below Tailwind utilities.
- **Density.** Quiet Pro controls are fitted to Agency's 42px fields, 6px field radius and 44px
  touch targets in `globals.css`.
- **Contrast.** `design-system.spec.ts` resolves `var(--…)` through the package's tokens and
  checks every pair in both themes. Run it after any token or package change.

Superseded direction, 2026-10-15: warm gray surfaces and deep green actions.

## Research and decisions

| Reference | Relevant pattern | Decision for Agency |
| --- | --- | --- |
| [Linear: latest design refresh](https://linear.app/now/behind-the-latest-design-refresh) | Less saturated warm neutrals, quieter inactive elements, predictable header placement | Keep most of the interface neutral; distinguish workspace navigation from project actions |
| [Atlassian: color](https://atlassian.design/foundations/color) | Separate neutral, brand, status and decorative roles; choose semantic tokens instead of shades | Name colors by purpose and interaction state; keep content labels separate from UI chrome |
| [Shopify: visual design](https://shopify.dev/docs/apps/design/visual-design) | Neutral readable text, consistent components, color paired with labels/icons, minimum text contrast | Compact controls with explicit states; messages explain success, warnings and errors |
| [Radix: scale roles](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) | Distinct steps for surfaces, interaction backgrounds, borders, solid fills and text | Define separate surface, hover, selected, border and foreground tokens |

These are selected first-party design references, not a ranking of products.
We adopt their methods of hierarchy and consistency rather than combine their
logos, component libraries or exact palettes. In particular, Shopify's admin
uses its own color meanings; Agency uses teal as its brand accent and
uses explicit status labels to distinguish brand actions from success states.

## Sources of truth

| Concern | File |
| --- | --- |
| Palette, type scale, radii, elevation | `src/styles/tokens.css` |
| Global baseline, focus, touch targets, motion | `src/app/globals.css` |
| Buttons, fields, badges, panels, page headers, empty states | `src/components/ui.tsx` |
| Combobox, MultiCombobox, Checkbox, RadioGroup, Switch, Kbd | `@carl0010/quiet-pro`, re-exported from `src/components/ui.tsx` |
| Quiet Pro palette, pickers and docs | `Carl0010/design-system`, vendored in `vendor/` |
| Outline icons and brand mark | `src/components/icon.tsx` |
| Content label/project/avatar mappings | `src/lib/content-colors.ts` |
| Automated enforcement | `design-system-eslint.mjs` |
| Contrast regression checks | `src/lib/design-system.spec.ts` |

The stylesheet is imported once by the root layout, so every route uses the
same foundations. New components must consume these tokens. Shared controls come
from `ui.tsx`, which uses Agency's own primitives plus Quiet Pro; do not add another
component library (shadcn/ui, Base UI, MUI…) to fix an individual screen. A control that
several products need belongs in Quiet Pro, not here.

## Color roles

| Role / utility | Source (light / dark) | Use |
| --- | --- | --- |
| `bg-background` | Quiet Pro `--bg` | App canvas and quiet navigation rail |
| `bg-board-canvas` | Agency `#FCFDFE` / `#111315` | Board work area: lighter than the sidebar in light mode, one step up in dark; pair with foreground/secondary/muted text |
| `bg-lane` | Quiet Pro `--surface-3` / `--bg` | Board lanes and group columns. Always below the cards in them: grey under white cards in light, darker than the canvas in dark |
| `bg-surface` | Quiet Pro `--surface-2` | Cards, panels, dialogs, main headers |
| `bg-popover` | Quiet Pro `--surface-overlay` | Menus, popovers, select lists, the command palette, person cards, tour. One step above the dialog or card it opens from (lighter in dark; shadow and hairline in light) |
| `bg-field` | Quiet Pro `--field` | Inputs, selects, textareas and checkbox boxes. Sunken in dark so a field reads as a field inside a card or dialog |
| `hover:bg-hover` | Quiet Pro `--surface-hover` | Translucent hover for rows, menu items, ghost and secondary buttons. Works on every surface; never use `hover:bg-subtle`, which vanishes on lanes and menus |
| `bg-subtle` | Quiet Pro `--surface-3` | Opaque quiet fills: chips, counts, code, table headers |
| `bg-muted` | Agency `#E8EAEC` / `#282C30` | Neutral selected/pressed surfaces, chips |
| `text-foreground` | Quiet Pro `--text` | Titles, content, primary values |
| `text-secondary-foreground` | Quiet Pro `--text-muted` | Supporting labels and navigation |
| `text-muted-foreground` | Quiet Pro `--text-subtle` | Metadata, descriptions, placeholders |
| `border-border` | Quiet Pro `--border` | Noninteractive surfaces and dividers |
| `border-input` | Quiet Pro `--border-strong` | Form controls that need a visible boundary |
| `bg-primary`, `text-primary` | Quiet Pro `--accent` | Main actions, links, focus, checked controls |
| `hover:bg-primary-hover` | Quiet Pro `--accent-hover` | Primary hover |
| `active:bg-primary-active` | Agency `#00555B` / `#8FEEED` | Primary pressed |
| `bg-primary-subtle` / `text-primary-text` | Quiet Pro `--accent-soft` / `--accent-text` | Selected navigation, low-emphasis brand accents |
| `bg-danger` / `text-danger-text` | Agency `#B63132` (fill, both themes) / Quiet Pro `--danger` | Destructive actions / errors |
| `text-warning-text` | Quiet Pro `--warning` | Due soon, trial ending, action needed |
| `text-success-text` | Quiet Pro `--success` | Completed work and positive status |
| `text-info-text` | Agency `#1D5B92` / `#A5CCF4` | Informational messages |

Status roles have matching `*-subtle`, `*-muted` where needed, and `*-border`
tokens. Never use an accent as a substitute for a status. Unread counts use
brand/neutral emphasis, not error red. A guest chip is neutral: guest access is
not a warning. Yellow search highlighting is a separate `highlight` role.

Use `primary-foreground` on primary fills and `inverse-foreground` on dark
status fills. Do not use muted text on dark fills or rely on opacity to make
essential metadata quieter. Disabled controls may use reduced opacity but
must remain identifiable and unavailable to activation.

The base pairs are checked with WCAG relative luminance calculations:

| Pair | Light | Dark |
| --- | --- | --- |
| Main text on canvas | 17.16:1 | 17.66:1 |
| Muted text on surface | 5.50:1 | 5.63:1 |
| Muted text on subtle surface | 4.69:1 | 5.14:1 |
| Primary foreground on primary | 5.22:1 | 9.75:1 |
| Input outline on surface | 3.64:1 | 3.18:1 |

These checks validate the defined opaque token pairs. They do not certify every
page, opacity combination or user-supplied image. Keep text at least 4.5:1 and
control/focus boundaries at least 3:1 on their actual adjacent background.

### Elevation

Each layer that floats is one step above what it opens from: board lane → card → dialog →
popover. In dark mode a higher layer is lighter (`lane` < `surface` < `popover`) and carries a faint
light hairline in its shadow; in light mode cards, dialogs and popovers stay white and are told apart
by `shadow-lg`/`shadow-xl`, which also carry a 1px hairline. So a Select opened inside a dialog
always shows its own edge in both themes. Toasts use `bg-inverse`: near-black in light, a raised grey
in dark.

### Content color exceptions

Members choose card-label and project colors. Those use `bg-label-*` through
`content-colors.ts`, not brand/status utilities. Blue labels are actually blue;
`blue-*` is no longer secretly remapped to green. Color dots do not replace
project names, and label selection retains its text/accessible label.

Avatars use the fixed six-color `avatar-*` family. White initials on all six
fills pass the text-contrast checks. Never invent another color in a component.

## Typography

Keep Geist Sans and Geist Mono already loaded by the app. Use regular/medium
for body and controls, semibold for headings. Avoid long uppercase labels.

| Utility | Size / line height | Purpose |
| --- | --- | --- |
| `text-caption` | 12 / 16px | Metadata, badges, timestamps |
| `text-label` | 13 / 20px | Controls, field labels, compact navigation |
| `text-body` | 14 / 24px | Main body content |
| `text-body-lg` | 15 / 24px | Card/section emphasis |
| `text-page` | 24 / 32px | Page heading |

Use one clear page heading, then section headings. Board toolbars can use an
18px heading to preserve space for work content. Marketing pages can use a
larger display heading. Use monospace for card keys and keyboard shortcuts;
use tabular numbers for counts and dates. On mobile, form controls use 16px
text to avoid iOS zoom. Small avatar initials are a limited exception to the
12px caption minimum; full names remain available in adjacent text or titles.

## Spacing, layout and elevation

- Use the existing Tailwind 4px spacing grid. Prefer 8, 12, 16, 24 and 32px;
  use 4px for tightly related metadata. Half steps are reserved for compact controls.
- Page content uses `ui-page` with 16px mobile / 32px desktop horizontal gutters.
  Default maximum width is 1024px; forms/settings may use a narrower max width.
- `PageHeader` puts the title/description on the left and actions on the right,
  stacking naturally on small screens. Use one primary action per action group.
- Use a 56px icon module rail beside the 256px contextual sidebar, with 320px
  board lanes on desktop. Below 640px, board lanes are 85vw (at most 320px), sit side
  by side and snap as you swipe, so the next lane peeks in.
- Follow [navigation ownership](NAVIGATION.md): workspace and project destinations
  live in the module rail and contextual sidebar; the global app bar owns search and
  theme/sidebar toggles, while page headers keep
  local actions. Do not add a duplicate project rail or Board/Chat/Team tabs.
- Card details use the non-modal right inspector in
  [navigation ownership](NAVIGATION.md#card-inspector). Keep the board usable
  beside it and use a single content column inside the drawer.
- Control radius: 6px (`rounded-md`). Cards: 8px. Panels/dialogs: 12px.
  Fully rounded shapes are reserved for avatars, compact pills and status dots.
- Prefer borders to shadows. `shadow-sm` for subtle controls/cards, `shadow-md`
  for hover elevation, `shadow-lg` for menus/dialogs, `shadow-xl` for drag overlays.
  Avoid decorative gradients, glass effects and shadow stacks in workspace chrome.

## Kanban dimensions and hierarchy

The board uses a deliberate hierarchy rather than one compact size for every
piece of information. Reuse the semantic type and color tokens above.

| Element | Type / dimensions | Purpose |
| --- | --- | --- |
| Project title | 18px / 24px, semibold | Saved project icon/color beside the name; no card/list counts or client-description line |
| List heading | 14px / 20px, semibold | Stable header with a separate count badge and action target |
| Card title | 15px / 24px, medium | Up to three visible lines; full title in the control label and tooltip |
| Labels and facts | 12px / 16px | Readable label names, due state, checklist/file/comment counts |
| Card footer | 12px / 16px key; 24px avatars | Identity and ownership in a separate row, even for simple cards |
| Add list tile | 320px × 60px | Matches column width and the shared list header height |
| Desktop list | 320px wide; content height up to the available board height | Short lists fit their content; long lists scroll internally |
| Empty card area | At least 200px high | Centered empty message with a useful drop target |
| Board gutter | 16px | Aligns the compact project header, toolbar and lists |
| Between lists / cards | 16px / 12px | Clear grouping without compressing card content |
| Inside a card | 16px | Common text and metadata inset |
| Controls | 36px desktop; at least 44px below 640px | Aligned toolbar and accessible mobile touch targets |

The Kanban header itself is the list drag area; do not add a separate grip.
Keep title click/rename, keyboard reordering and menu/input interaction working.
The sidebar retains `background`; the board canvas uses `board-canvas` in both
themes. Add list uses a `border-hover` outline against the canvas for contrast.

Keep list headings and the bottom Add card control outside the list's scrolling
card area. Long lists scroll internally; users can still identify the list and
create a card. Empty outlines have a 200px minimum height, with the message centered;
their columns size to that area instead of filling the viewport.
Click Add list to create and focus its real column header instead of opening
a separate creation form. Empty lists say **No cards yet**; filtered lists with no matches
say **No matching cards**. Keep one Add card control per list as a separate bordered surface below the
list panel, with a 12px gap. The form expands inside that separate tile.

User-selected label colors appear as dots beside their readable names on a
neutral chip. Do not put low-contrast text on arbitrary label fills. Card facts
wrap independently from the footer so dates, counts, keys and assignees cannot
compete for one row. Plain cards still show their key.

The global app bar is 56px high. Board chrome uses a compact project row and
one toolbar with the Kanban/List switch on the left and card search, Filters and
Clear aligned right. Search says **Search by card name**. Do not
give the view switch its own full-width row or repeat the empty-list guidance
in a separate banner. On mobile the toolbar stays one row: icon-only view switch,
a search icon that expands over the row, and an icon Filters button, all 44px targets.

Show the main information by default and put the rest one step away. Secondary
project actions go in the header's ⋯ menu, view options (Group by, arrival
estimates) in the Filters panel, card actions in the card's ⋯ menu. Metadata
lines render only when they have content; do not print placeholders like "No due
date" on tiles.

Filters open a non-modal native popover titled View and filters, anchored to their
button, with the view options first, then member
names/avatars, label names/colors, due date, selection counts, Reset and Done.
Opening or changing filters never inserts a header row or moves board content.
Keep the panel within the viewport and update its position on resize/scroll and
selection changes. Focus Close on open; Escape/outside click dismiss, and explicit
close/Done returns focus to the trigger. Reset clears structured filters while
preserving card search; toolbar Clear resets everything. Active filters persist
in the URL but never cause the popover to open automatically after reload.

The project header wraps as the available board pane narrows, including when
the card drawer is open. Filters use the shared input and consistent control
heights. Board lanes scroll horizontally inside the board (with snap below 640px);
never widen the document to fit every list.

`e2e/board-ux.spec.ts` checks a populated board at 1440px, 1024px and 390px,
including metadata bounds and access to list headings and bottom actions.

## Components and interactions

```tsx
<Button>Save changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete attachment</Button>
<Field label="Project name" hint="Use a name your team recognizes.">
  <Input name="name" required />
</Field>
<Badge tone="warning">Due soon</Badge>
<PageHeader title="Projects" description="Work shared with you and your teams." />
<Combobox aria-label="Project" value={projectId} onChange={setProjectId}
  options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" />
<MultiCombobox aria-label="Labels" values={labelIds} onChange={setLabelIds} options={labelOptions} />
<RadioGroup legend="Due" name="due" value={due} onChange={setDue} options={dueOptions} />
<Switch label="Compact rows" checked={compact} onChange={setCompact} />
```

- Shared `Button` supports primary, secondary, ghost and danger plus default,
  small and icon sizes. An icon-only button requires an accessible label.
- Use `Input`, `Textarea` and `Select` for new forms. Mark invalid controls with
  `aria-invalid`, associate error text with `aria-describedby`, and show API failures.
- Choose a picker by list size: `RadioGroup` for 2–5 visible choices, `Select` for a
  fixed list, `Combobox` when people would rather type than scroll (countries, timezones,
  anything long or growing), `MultiCombobox` for several values such as labels or
  assignees. Never hand-style a raw `<select>`.
- `Combobox` and `MultiCombobox` follow the ARIA 1.2 combobox pattern: arrow keys move,
  Enter picks, Escape closes (and clears a single value when already closed), Backspace
  in an empty multi field removes the last chip. Filtering is accent- and case-insensitive
  and ranks prefix matches first (unit-tested in the Quiet Pro repository). Pass `name` to
  submit with a form; pass `aria-label` when there's no visible label. `onCreate` offers "Create …" for new text; the caller creates the
  item through the API and then selects it.
- `Checkbox` is for values saved with a form; `Switch` is for settings that apply
  immediately. `Kbd` shows shortcuts in menus and tooltips.
- Use `Panel`, `PageHeader`, `EmptyState` and `Badge` instead of rebuilding their
  spacing, color and typography for each feature.
- Use `ui-nav-link` and `ui-tab` with `aria-current`/`aria-selected`. Selection
  is visible through surface and weight, not text color alone.
- All keyboard-operable elements have a visible focus ring: a 2px accent outline 2px away, with a
  transparent gap so it reads the same on cards, dialogs and menus. Fields focus with a 2px accent
  edge and a soft halo. Default shared
  controls are 36px high; compact controls are 32px. Mobile `.tap` targets are 44px.
  Filled buttons (primary, danger) are 40px tall on phones with an invisible 2px
  `::after` margin above and below, so they still take 44px of touch. Buttons use
  the 8px (`rounded-lg`) radius. The e2e `touchBox` helper measures this real touch area.
- On phones, a dialog with several fields fills the screen (`Dialog`, or
  `FULL_SCREEN_ON_PHONE` for a hand-built one): no margin or corners, header pinned
  at the top, and `DialogActions` pinned at the bottom with full-width buttons. A
  dialog asking one question or for one field uses `size="compact"`.
- Pick-or-create fields (labels) use Quiet Pro's `MultiCombobox` with `onCreate`:
  typing filters, and a name with no exact match offers "Create “…”", which opens
  a compact dialog for the rest (the label's colour).
- Reorderable rows inside a card (checklists and their items) use a grip handle
  (dnd-kit sortable): drag it, or Space to lift, arrows to move, Space to drop.
- Hover is subtle, pressed states are explicit, and disabled controls cannot
  activate. Avoid globally moving/scaling buttons on click.
- Use consistent SVG outline icons. No emoji as icons in navigation or actions.
  User-authored emoji and existing attachment-message content are unaffected.
- Transitions use 150ms and the shared easing curve. Respect reduced motion;
  do not animate layout or use decorative looping effects.
  Navigation panels use the documented exception in [Panel motion](NAVIGATION.md#panel-motion):
  `--duration-panel` is 220ms, with `--ease-ui`, for sidebar/inspector resizing,
  panel slides and the mobile navigation backdrop. Keep content width stable
  during travel and make closed/exiting controls inert.

## Agent workflow and enforcement

1. Read this file and the closest existing screen before editing UI.
2. Reuse semantic tokens and shared components. Keep API and permission behavior
   unchanged during styling tasks. Keep the guest portal's import boundary intact.
3. Color literals belong in `styles/tokens.css` only. The ESLint rule
   `design-system/semantic-colors` rejects raw palette utilities and literal
   arbitrary colors in component strings. Numeric layout/progress styles are allowed.
4. Add a token only when no current role fits. Document its role and foreground
   pairing; extend the contrast checks. Do not add one-off per-screen palettes.
5. Run web lint, typecheck, unit tests and a production build. Check mobile
   overflow, focus, loading/empty/error states and a populated board.

Both light and dark themes are supported through the same semantic roles.
`html[data-theme='dark']` overrides surface, text, control and status-container
tokens. Content colors, avatar fills and status fills retain their identities.
Primary fills use `primary-foreground`; inverse/status fills use
`inverse-foreground`. Label text sits on neutral surfaces beside colored dots.
`design-system.spec.ts` tests text/control contrast in both modes.

The app bar's labelled toggle saves a browser preference. A before-paint root
script prevents a light flash on reload; without a saved choice it follows the
OS. Theme is local presentation state, never workspace/project data.

Board presentation rules live in [Board views](BOARD_VIEWS.md). List view reuses
the Kanban data, header actions and card composer; compact rows respond to the
content pane width, including when a card drawer is open.

## Select fields

Use Quiet Pro's `Select` (re-exported from `components/ui.tsx`) for every select,
including toolbar filters, settings, onboarding, imports, the card drawer and the
guest portal. Pass `options` (`value`, `label`, and optionally `icon` or
`description`); `onChange` receives the chosen value. Call sites own width and
layout only (`className` sizes the field); Quiet Pro owns the field and menu, and
`app/globals.css` only adapts its density and radius to Agency. Shared choices
(guest access, project access, team and workspace roles) live in
`lib/access-options.ts`.

The field is a button following the ARIA 1.2 select-only combobox pattern; the menu
is a listbox in the browser's top layer, so drawers, dialogs and popovers never clip
it. Arrow keys, Home/End and PageUp/PageDown move, typing jumps to a matching
option, Enter/Space/Tab pick, Escape closes and keeps focus on the field. The chosen
option shows an accent tick; option icons (colour dots for labels and project
status) also show in the field. Options are 44px tall on mobile.

In forms, `name` puts the value in `FormData` and `required` blocks submitting until
something is chosen, with the browser's message at the field; a form reset restores
`defaultValue`. Both work through an invisible native select that Quiet Pro lays over
the field. Long lists (countries, timezones) use `Combobox` instead, so people can
type to filter.

This replaces the earlier native `<select>` with `appearance: base-select`, which
only Chromium-based browsers styled; Firefox and Safari showed the plain platform
menu. `e2e/select-fields.spec.ts` covers the themed menu in both themes, keyboard
and typeahead, nested filter popovers and share dialogs, mobile option size and
bounds, form values and required fields. Previews are indexed in
`docs/previews/README.md`.

## Confirmation dialogs

Use `useConfirm` from `src/components/confirmation.tsx`; `ConfirmationProvider`
is mounted globally. Never call browser confirm, alert or prompt. Existing API
actions stay in their callers and run only after acceptance. The shared modal
uses a styled native dialog in the top layer, so it works above drawers and
other dialogs in both themes, including the guest portal. It owns no business data.

Give each action a specific title, consequence description and confirm verb.
Destructive actions use the danger button; access grants may use primary. Cancel
receives initial focus. Escape, close and backdrop dismiss without a mutation;
Tab stays within the modal and closing restores focus. Requests queue instead
of replacing one another. Provider teardown dismisses outstanding requests.

## Loading states

`components/skeleton.tsx` owns the shared loading shapes: board columns/List rows,
card details, project/team tiles, people rows, settings fields and conversation
messages. Use the layout closest to the incoming content and reserve its space.
Keep useful already-loaded content visible during background refetches; skeletons
are for initial pending queries. Do not add artificial delays to show them.

App boot and redirects (signed-in root, workspace and portal layouts before the session or
workspace resolves) have no layout to hold a skeleton, so they show `AppLoader`: the brand
mark in a spinning ring with "Agency" below, centred on the screen. It fades in after 250ms
so fast loads never flash it, and the ring breathes instead of spinning under reduced motion.
Never use it inside a page; content inside the shell keeps its skeleton.

Use semantic `muted`, `subtle`, `surface` and `border` tokens in both themes. A
single polite status announces the region's loading label; decorative shapes are
hidden from assistive technology and expose no pretend inputs or buttons. The
subtle opacity animation stops for reduced motion. Labelled spinners remain for
operations whose layout is unknown, such as signing in or reading an import.
