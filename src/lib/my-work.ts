import { DUE_GROUPS, dueWindowOf } from './board-grouping';
import type { DueWindow, MyWorkCard } from './types';

export const myWorkKey = (workspaceId: string) => ['my-work', workspaceId] as const;

export interface MyWorkGroup { id: DueWindow; name: string; cards: MyWorkCard[] }

/**
 * My work's sections in the person's timezone: Overdue, Today, Next 7 days, Later, No due date and
 * Done, empty ones left out. Open cards keep the API's order (earliest due first); done cards show
 * the most recently ticked first.
 */
export function groupMyWork(cards: readonly MyWorkCard[], now: Date, timezone: string): MyWorkGroup[] {
  const groups = DUE_GROUPS.map((group) => ({ ...group, cards: [] as MyWorkCard[] }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const card of cards) byId.get(dueWindowOf(card, now, timezone))!.cards.push(card);
  byId.get('done')!.cards.sort((a, b) => Date.parse(b.dueCompletedAt!) - Date.parse(a.dueCompletedAt!));
  return groups.filter((group) => group.cards.length);
}

/** How a tick looks before the server answers: done now (a card with no date gets today), or open again. */
export function previewToggle(card: MyWorkCard, done: boolean, now: Date, dueBefore: string | null | undefined): MyWorkCard {
  if (done) return { ...card, dueAt: card.dueAt ?? now.toISOString(), dueCompletedAt: now.toISOString() };
  return { ...card, dueAt: dueBefore === undefined ? card.dueAt : dueBefore, dueCompletedAt: null };
}
