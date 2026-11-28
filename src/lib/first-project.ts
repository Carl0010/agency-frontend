import type { TemplateSummary } from './types';

/** "Start with" on the first-project step (§3.5 step 2): a blank board or one of the templates. */
export const BLANK_START = 'blank';

/**
 * The project name after the owner picks what to start with. A name they typed is theirs and stays;
 * a name that only came from the last template picked follows the new pick (and clears for blank).
 */
export function nameForStart(current: string, previousAuto: string | null, start: string, templates: readonly TemplateSummary[]): { name: string; auto: string | null } {
  const owned = current.trim() !== '' && current !== previousAuto;
  if (owned) return { name: current, auto: null };
  const template = templates.find((t) => t.id === start);
  if (!template) return { name: '', auto: null };
  return { name: template.name, auto: template.name };
}

/** One short line under each choice: what the board starts with. */
export function startDescription(t: TemplateSummary): string {
  return `${t.description} ${t.lists.length} lists, ${t.cardCount} example cards.`;
}
