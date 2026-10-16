# Agency design system

Accepted direction, 2026-10-15: a calm, precise workspace for small agencies.
Use warm gray surfaces, deep green actions, legible compact typography, and
clear boundaries between navigation, work content and client communication.
The palette is Agency's own; it does not copy a product's branding.

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
uses its own color meanings; Agency retains green as its brand accent and
uses explicit status labels to distinguish brand actions from success states.

## Sources of truth

| Concern | File |
| --- | --- |
| Palette, type scale, radii, elevation | `src/styles/tokens.css` |
| Global baseline, focus, touch targets, motion | `src/app/globals.css` |
| Buttons, fields, badges, panels, page headers, empty states | `src/components/ui.tsx` |
| Outline icons and brand mark | `src/components/icon.tsx` |
| Content label/project/avatar mappings | `src/lib/content-colors.ts` |
| Automated enforcement | `design-system-eslint.mjs` |
| Contrast regression checks | `src/lib/design-system.spec.ts` |

The stylesheet is imported once by the root layout, so every route uses the
same foundations. New components must consume these tokens. This checkout
uses the existing React primitives, not shadcn/ui or Base UI; do not add a second
component library to fix an individual screen.

## Color roles

| Role / utility | Value | Use |
| --- | --- | --- |
| `bg-background` | `#F7F8F5` | App canvas and quiet navigation rail |
| `bg-board-canvas` | `#FAFBF9` light / `#18201B` dark | A lighter shade of the warm sidebar palette; pair with foreground/secondary/muted text |
| `bg-surface` | `#FFFFFF` | Cards, forms, dialogs, main headers |
| `bg-subtle` | `#F0F2EE` | Board lanes, code, secondary control hover |
| `bg-muted` | `#E7EBE5` | Neutral selected/pressed surfaces |
| `text-foreground` | `#202822` | Titles, content, primary values |
| `text-secondary-foreground` | `#46534A` | Supporting labels and navigation |
| `text-muted-foreground` | `#626F65` | Metadata, descriptions, placeholders |
| `border-border` | `#DBE1D9` | Noninteractive surfaces and dividers |
| `border-input` | `#859287` | Form controls that need a visible boundary |
| `bg-primary`, `text-primary` | `#196747` | Main actions, links, focus |
| `hover:bg-primary-hover` | `#145539` | Primary hover |
| `active:bg-primary-active` | `#10452F` | Primary pressed |
| `bg-primary-subtle` / `text-primary-text` | `#EDF5EE` / `#174E36` | Selected navigation, low-emphasis brand accents |
| `bg-danger` / `text-danger-text` | `#B43737` / `#942E2E` | Destructive actions / errors |
| `text-warning-text` | `#805012` | Due soon, trial ending, action needed |
| `text-success-text` | `#235C3B` | Completed work and positive status |
| `text-info-text` | `#244F79` | Informational messages |

Status roles have matching `*-subtle`, `*-muted` where needed, and `*-border`
tokens. Never use an accent as a substitute for a status. Unread counts use
brand/neutral emphasis, not error red. A guest chip is neutral: guest access is
not a warning. Yellow search highlighting is a separate `highlight` role.

Use `primary-foreground` on primary fills and `inverse-foreground` on dark
status fills. Do not use muted text on dark fills or rely on opacity to make
essential metadata quieter. Disabled controls may use reduced opacity but
must remain identifiable and unavailable to activation.

The base pairs are checked with WCAG relative luminance calculations:

| Pair | Contrast |
| --- | --- |
| Main text on canvas | 14.19:1 |
| Muted text on white | 5.28:1 |
| Muted text on subtle surface | 4.68:1 |
| White text on primary | 6.84:1 |
| Input outline on white | 3.25:1 |

These checks validate the defined opaque token pairs. They do not certify every
page, opacity combination or user-supplied image. Keep text at least 4.5:1 and
control/focus boundaries at least 3:1 on their actual adjacent background.

### Content color exceptions

Clients choose card-label and project colors. Those use `bg-label-*` through
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
  board lanes on desktop. Below 640px,
  preserve the existing one-list-at-a-time board behavior.
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
in a separate banner. The toolbar wraps on mobile while keeping 44px targets.

Filters open a non-modal native popover anchored to their button, with member
names/avatars, label names/colors, due date, selection counts, Reset and Done.
Opening or changing filters never inserts a header row or moves board content.
Keep the panel within the viewport and update its position on resize/scroll and
selection changes. Focus Close on open; Escape/outside click dismiss, and explicit
close/Done returns focus to the trigger. Reset clears structured filters while
preserving card search; toolbar Clear resets everything. Active filters persist
in the URL but never cause the popover to open automatically after reload.

The project header wraps as the available board pane narrows, including when
the card drawer is open. Filters use the shared input and consistent control
heights. Preserve the single selected list below 640px and horizontal board
scrolling on larger screens; never widen the document to fit every list.

`e2e/board-ux.spec.ts` checks a populated board at 1440px, 1024px and 390px,
including metadata bounds and access to list headings and bottom actions.

## Components and interactions

```tsx
<Button>Save changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="danger">Delete attachment</Button>
<Field label="Project name" hint="Use a name your client recognizes.">
  <Input name="name" required />
</Field>
<Badge tone="warning">Due soon</Badge>
<PageHeader title="Clients" description="All your client work in one place." />
```

- Shared `Button` supports primary, secondary, ghost and danger plus default,
  small and icon sizes. An icon-only button requires an accessible label.
- Use `Input`, `Textarea` and `Select` for new forms. Mark invalid controls with
  `aria-invalid`, associate error text with `aria-describedby`, and show API failures.
- Use `Panel`, `PageHeader`, `EmptyState` and `Badge` instead of rebuilding their
  spacing, color and typography for each feature.
- Use `ui-nav-link` and `ui-tab` with `aria-current`/`aria-selected`. Selection
  is visible through surface and weight, not text color alone.
- All keyboard-operable elements have a visible focus ring. Default shared
  controls are 36px high; compact controls are 32px. Mobile `.tap` targets are 44px.
- Hover is subtle, pressed states are explicit, and disabled controls cannot
  activate. Avoid globally moving/scaling buttons on click.
- Use consistent SVG outline icons. No emoji as icons in navigation or actions.
  User-authored emoji and existing attachment-message content are unaffected.
- Transitions use 150ms and the shared easing curve. Respect reduced motion;
  do not animate layout or use decorative looping effects.

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
