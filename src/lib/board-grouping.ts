import type { Assignable, Board, CardTile, DueWindow, PersonRef, RescheduleTarget } from './types';
export type { Assignable, DueWindow, RescheduleTarget } from './types';

export type Grouping = 'list' | 'assignee' | 'due';
export interface CardGroup { id: string; name: string; cards: CardTile[]; target: boolean }
export const DUE_GROUPS: readonly { id: DueWindow; name: string }[] = [
  { id: 'overdue', name: 'Overdue' }, { id: 'today', name: 'Today' },
  { id: 'next_7_days', name: 'Next 7 days' }, { id: 'later', name: 'Later' },
  { id: 'none', name: 'No due date' }, { id: 'done', name: 'Done' },
];
export const parseGrouping = (value: string | null, guest = false): Grouping => value === 'due' ? 'due' : value === 'assignee' && !guest ? 'assignee' : 'list';

const formatters = new Map<string, Intl.DateTimeFormat>();
function wall(instant: Date, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  return { year: values.year!, month: values.month!, day: values.day!, hour: values.hour!, minute: values.minute!, second: values.second! };
}

/** Calendar arithmetic in the profile timezone, including DST; never seven elapsed 24h periods. */
export function localDayAt(now: Date, timezone: string, days: number, end = false): Date {
  const w = wall(now, timezone);
  const guess = Date.UTC(w.year, w.month - 1, w.day + days, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0);
  const offset = (ms: number) => {
    const p = wall(new Date(ms), timezone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  };
  const first = guess - offset(guess);
  return new Date(Math.min(first, guess - offset(first)));
}
export function dueWindowOf(card: Pick<CardTile, 'dueAt' | 'dueCompletedAt'>, now: Date, timezone: string): DueWindow {
  return classifyDue(card, now.getTime(), localDayAt(now, timezone, 1).getTime(), localDayAt(now, timezone, 8).getTime());
}
function classifyDue(card: Pick<CardTile, 'dueAt' | 'dueCompletedAt'>, now: number, todayEnds: number, next7DaysEnd: number): DueWindow {
  if (card.dueCompletedAt) return 'done';
  if (!card.dueAt) return 'none';
  const due = new Date(card.dueAt).getTime();
  if (due < now) return 'overdue';
  if (due < todayEnds) return 'today';
  return due < next7DaysEnd ? 'next_7_days' : 'later';
}
export function nextWindowBoundary(cards: readonly CardTile[], now: Date, timezone: string): number {
  return Math.min(localDayAt(now, timezone, 1).getTime(), ...cards.filter((card) => !card.dueCompletedAt && card.dueAt && new Date(card.dueAt).getTime() >= now.getTime()).map((card) => new Date(card.dueAt!).getTime() + 1));
}
/** End of a picked calendar date in the profile timezone, even when the browser uses another zone. */
export function pickedDateEnd(date: string, timezone: string): Date {
  const anchor = new Date(`${date}T12:00:00Z`);
  const w = wall(anchor, timezone);
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.UTC(w.year, w.month - 1, w.day)) / 86400000);
  return localDayAt(anchor, timezone, days, true);
}
export function boardGroups(board: Board, grouping: Exclude<Grouping, 'list'>, people: readonly Assignable[], now: Date, timezone: string): CardGroup[] {
  const cards = board.lists.flatMap((list) => list.cards);
  if (grouping === 'due') {
    const todayEnds = localDayAt(now, timezone, 1).getTime();
    const next7DaysEnd = localDayAt(now, timezone, 8).getTime();
    const groups: CardGroup[] = DUE_GROUPS.map((group) => ({ ...group, target: group.id !== 'overdue', cards: [] }));
    const byId = new Map(groups.map((group) => [group.id, group]));
    // Stable sort retains board order for equal dates. Compute timezone bounds once per board.
    [...cards].sort((a, b) => (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity)).forEach((card) => {
      byId.get(classifyDue(card, now.getTime(), todayEnds, next7DaysEnd))!.cards.push(card);
    });
    return groups;
  }
  const names = new Map(cards.flatMap((card) => card.assignees.map((person) => [person.id, { userId: person.id, name: person.name, avatarUrl: person.avatarUrl }] as const)));
  people.forEach((person) => names.set(person.userId, person));
  return [...names.values()].sort((a, b) => a.name.localeCompare(b.name) || a.userId.localeCompare(b.userId)).map((person) => ({ id: person.userId, name: person.name, target: people.some((p) => p.userId === person.userId), cards: cards.filter((card) => card.assignees.some((p) => p.id === person.userId)) })).concat([{ id: 'unassigned', name: 'Unassigned', target: true, cards: cards.filter((card) => !card.assignees.length) }]);
}
export function assigneeChange(source: string, target: string) {
  return { remove: source === 'unassigned' ? [] : [source], add: target === 'unassigned' ? [] : [target] };
}
export function previewAssignment(card: CardTile, source: string, target: string, people: readonly Assignable[]): CardTile {
  const remaining = card.assignees.filter((p) => p.id !== source);
  const person = people.find((p) => p.userId === target);
  const added: PersonRef[] = person && !remaining.some((p) => p.id === target) ? [{ id: person.userId, name: person.name, avatarUrl: person.avatarUrl, active: true }] : [];
  return { ...card, assignees: [...remaining, ...added] };
}
export function previewReschedule(card: CardTile, to: RescheduleTarget, now: Date, timezone: string, picked?: string): CardTile {
  if (dueWindowOf(card, now, timezone) === to) return card;
  if (to === 'none') return { ...card, dueAt: null, dueCompletedAt: null };
  if (to === 'done') return { ...card, dueAt: card.dueAt ?? now.toISOString(), dueCompletedAt: now.toISOString() };
  return { ...card, dueAt: to === 'later' ? picked! : localDayAt(now, timezone, to === 'today' ? 0 : 7, true).toISOString(), dueCompletedAt: null };
}
