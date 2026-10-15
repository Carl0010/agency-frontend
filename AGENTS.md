<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend design system

Before changing UI, read [the design system](../../docs/frontend/DESIGN_SYSTEM.md).
For navigation changes also read [sidebar responsibilities](../../docs/frontend/NAVIGATION.md).

- `src/styles/tokens.css` owns colors, type sizes, radii and shadows.
- `src/app/globals.css` owns global focus, controls, motion and touch-target behavior.
- `src/components/ui.tsx` owns shared controls, badges, panels, headings and empty states.
- `src/components/icon.tsx` owns decorative outline icons and the brand mark.
- `src/lib/content-colors.ts` owns mappings for user-selected labels, projects and avatars.
- Use semantic color utilities. `design-system/semantic-colors` is an ESLint error.
- Keep business logic, API behavior and audience boundaries separate from visual changes.
- The workspace sidebar owns destinations, search, inbox and account controls.
  Page headers own local actions. Do not duplicate a project rail or member tabs.
- A new token needs a purpose and documented foreground/background pairing. Run the contrast tests.
- Light mode is the supported theme. Do not add a dark toggle without a complete token and visual audit.
- Do not add component-library dependencies or duplicate button/input variants for a single screen.
- Preserve the generated Next.js instructions above.
