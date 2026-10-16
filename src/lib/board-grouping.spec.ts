import { assigneeChange, boardGroups, dueWindowOf, localDayAt, nextWindowBoundary, parseGrouping, pickedDateEnd, previewAssignment, previewReschedule } from './board-grouping';
import type { Board, CardTile } from './types';

const now = new Date('2026-03-07T20:00:00Z'); // Noon in Los Angeles, the day before DST starts.
const tz = 'America/Los_Angeles';
function tile(id: string, dueAt: string | null = null, dueCompletedAt: string | null = null): CardTile {
  return { id, dueAt, dueCompletedAt, listId: 'l', boardId: 'b', projectId: 'p', number: 1, title: id, position: 1, hasDescription: false, archivedAt: null, assignees: [], labels: [], commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0 };
}
const alice = { userId: 'a', name: 'Alice', avatarUrl: null };
const bob = { userId: 'b', name: 'Bob', avatarUrl: null };
const person = (id: string) => ({ id, name: id, avatarUrl: null, active: true });
const board = (cards: CardTile[]): Board => ({ id: 'b', projectId: 'p', name: 'Board', boards: null, project: { id: 'p', name: 'Project', key: 'P', color: 'green', icon: 'folder', workspaceId: 'w', archivedAt: null }, lists: [{ id: 'l', name: 'One', position: 1, cards: cards.slice(0, 2) }, { id: 'm', name: 'Two', position: 2, cards: cards.slice(2) }] });

describe('published DueWindow rule in a non-UTC timezone', () => {
  it.each([
    [null, null, 'none'], [null, now.toISOString(), 'done'],
    ['2026-03-07T19:59:59.999Z', null, 'overdue'],
    [now.toISOString(), null, 'today'],
    ['2026-03-08T07:59:59.999Z', null, 'today'],
    ['2026-03-08T08:00:00Z', null, 'next_7_days'],
    ['2026-03-15T06:59:59.999Z', null, 'next_7_days'],
    ['2026-03-15T07:00:00Z', null, 'later'],
    ['2020-01-01T00:00:00Z', now.toISOString(), 'done'],
  ])('%s, completion %s → %s', (dueAt, done, expected) => expect(dueWindowOf(tile('c', dueAt, done), now, tz)).toBe(expected));
  it('uses calendar days across spring and fall DST changes', () => {
    expect(localDayAt(now, tz, 8).toISOString()).toBe('2026-03-15T07:00:00.000Z');
    expect(localDayAt(new Date('2026-10-31T20:00:00Z'), tz, 8).toISOString()).toBe('2026-11-08T08:00:00.000Z');
  });
  it('converts picked calendar dates in extreme zones', () => {
    expect(pickedDateEnd('2026-03-20', 'Pacific/Kiritimati').toISOString()).toBe('2026-03-20T09:59:59.000Z');
    expect(pickedDateEnd('2026-03-20', tz).toISOString()).toBe('2026-03-21T06:59:59.000Z');
  });
  it('refreshes at due expiration and at local midnight, ignoring completed dates', () => {
    const c = tile('soon', '2026-03-07T20:00:01Z');
    expect(nextWindowBoundary([c], now, tz)).toBe(Date.parse(c.dueAt!) + 1);
    expect(dueWindowOf(c, new Date(nextWindowBoundary([c], now, tz)), tz)).toBe('overdue');
    expect(nextWindowBoundary([{ ...c, dueCompletedAt: now.toISOString() }], now, tz)).toBe(Date.parse('2026-03-08T08:00:00Z'));
  });
});
describe('board grouping without changing server ordering', () => {
  it('duplicates multi-assignee tiles, preserves board order, and includes empty and unassigned groups', () => {
    const cards = [tile('first'), tile('second'), tile('third')];
    cards[0]!.assignees = [person('a'), person('b')]; cards[2]!.assignees = [person('a')];
    const groups = boardGroups(board(cards), 'assignee', [alice, bob, { ...alice, userId: 'z', name: 'Zoe' }], now, tz);
    expect(groups.map((g) => [g.name, g.cards.map((c) => c.id)])).toEqual([['Alice', ['first', 'third']], ['Bob', ['first']], ['Zoe', []], ['Unassigned', ['second']]]);
  });
  it('shows all six windows, sorts due dates and keeps board order for ties', () => {
    const groups = boardGroups(board([tile('laterToday', '2026-03-08T07:00:00Z'), tile('firstTie', now.toISOString()), tile('secondTie', now.toISOString())]), 'due', [], now, tz);
    expect(groups.map((g) => g.id)).toEqual(['overdue', 'today', 'next_7_days', 'later', 'none', 'done']);
    expect(groups[0]!.target).toBe(false);
    expect(groups[1]!.cards.map((c) => c.id)).toEqual(['firstTie', 'secondTie', 'laterToday']);
  });
  it('atomically swaps only the dragged assignee, without adding duplicates', () => {
    const card = { ...tile('c'), assignees: [person('a'), person('b'), person('other')] };
    expect(assigneeChange('a', 'b')).toEqual({ remove: ['a'], add: ['b'] });
    expect(previewAssignment(card, 'a', 'b', [alice, bob]).assignees.map((p) => p.id)).toEqual(['b', 'other']);
    expect(assigneeChange('unassigned', 'a')).toEqual({ remove: [], add: ['a'] });
    expect(assigneeChange('a', 'unassigned')).toEqual({ remove: ['a'], add: [] });
  });
  it('previews due writes, reopening Done and preserving list/position', () => {
    const c = tile('c', now.toISOString(), now.toISOString());
    expect(previewReschedule(c, 'today', now, tz)).toMatchObject({ listId: c.listId, position: c.position, dueAt: '2026-03-08T07:59:59.000Z', dueCompletedAt: null });
    expect(previewReschedule(c, 'none', now, tz)).toMatchObject({ dueAt: null, dueCompletedAt: null });
    expect(previewReschedule(tile('empty'), 'done', now, tz)).toMatchObject({ dueAt: now.toISOString(), dueCompletedAt: now.toISOString() });
  });
  it('falls back for unknown values and forbids guest assignee grouping', () => {
    expect(parseGrouping('bad')).toBe('list'); expect(parseGrouping('assignee', true)).toBe('list'); expect(parseGrouping('due', true)).toBe('due');
  });
});
