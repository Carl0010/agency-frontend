import { matchesFilters, type BoardFilters } from './filters';
import type { MyTaskCard, MyTasks, MyTaskSection } from './types';

export const myTasksKey = (workspaceId: string) => ['my-tasks', workspaceId] as const;

export interface SectionGroup {
  section: MyTaskSection;
  /** The cards shown: filters and Show completed applied. */
  cards: MyTaskCard[];
  /** Every card the person keeps in the section. */
  total: number;
}

const bySection = (a: MyTaskCard, b: MyTaskCard) => a.sectionPosition - b.sectionPosition || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The sections in order, each with its cards in the person's order. */
export function groupBySection(data: MyTasks, shown: (card: MyTaskCard) => boolean): SectionGroup[] {
  const sections = [...data.sections].sort((a, b) => a.position - b.position);
  return sections.map((section) => {
    const all = data.cards.filter((card) => card.sectionId === section.id).sort(bySection);
    return { section, cards: all.filter(shown), total: all.length };
  });
}

/** Done cards stay hidden until Show completed is on; filters work as on a board. */
export function shownCard(filters: BoardFilters, showCompleted: boolean, now: Date) {
  return (card: MyTaskCard) => (showCompleted || card.dueCompletedAt === null) && matchesFilters(card, filters, now);
}

/**
 * Moves a card into `sectionId`, just before `beforeId` (or last), the way the server will place it,
 * so a drop shows at once. Positions are only for ordering here; the server's answer replaces them.
 */
export function moveCardLocal(data: MyTasks, cardId: string, sectionId: string, beforeId: string | null): MyTasks {
  const card = data.cards.find((c) => c.id === cardId);
  if (!card) return data;
  const siblings = data.cards.filter((c) => c.sectionId === sectionId && c.id !== cardId).sort(bySection);
  const at = beforeId ? siblings.findIndex((c) => c.id === beforeId) : -1;
  const index = at < 0 ? siblings.length : at;
  const prev = siblings[index - 1]?.sectionPosition;
  const next = siblings[index]?.sectionPosition;
  const position = prev === undefined && next === undefined ? 1 : prev === undefined ? next! - 1 : next === undefined ? prev + 1 : (prev + next) / 2;
  return { ...data, cards: data.cards.map((c) => (c.id === cardId ? { ...c, sectionId, sectionPosition: position } : c)) };
}

/** The card a dragged card lands before when dropped at `index` among the shown cards of a section. */
export function beforeIdAt(shown: readonly MyTaskCard[], movingId: string, index: number): string | null {
  return shown.filter((c) => c.id !== movingId)[index]?.id ?? null;
}

/** Moving a section one step left or right: the section it goes before, null for last. */
export function sectionStep(sections: readonly MyTaskSection[], sectionId: string, step: -1 | 1): { beforeId: string | null } | null {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const from = ordered.findIndex((s) => s.id === sectionId);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ordered.length) return null;
  const rest = ordered.filter((s) => s.id !== sectionId);
  return { beforeId: rest[to]?.id ?? null };
}

/** The section moved as the server will place it. */
export function moveSectionLocal(data: MyTasks, sectionId: string, beforeId: string | null): MyTasks {
  const rest = [...data.sections].filter((s) => s.id !== sectionId).sort((a, b) => a.position - b.position);
  const moving = data.sections.find((s) => s.id === sectionId);
  if (!moving) return data;
  const at = beforeId ? rest.findIndex((s) => s.id === beforeId) : -1;
  rest.splice(at < 0 ? rest.length : at, 0, moving);
  return { ...data, sections: rest.map((s, i) => ({ ...s, position: i + 1 })) };
}

/** How a tick looks before the server answers: done now (a card with no date gets today), or open again. */
export function previewToggle(card: MyTaskCard, done: boolean, now: Date, dueBefore: string | null | undefined): MyTaskCard {
  if (done) return { ...card, dueAt: card.dueAt ?? now.toISOString(), dueCompletedAt: now.toISOString() };
  return { ...card, dueAt: dueBefore === undefined ? card.dueAt : dueBefore, dueCompletedAt: null };
}
