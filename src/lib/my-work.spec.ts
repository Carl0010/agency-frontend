import { groupMyWork, previewToggle } from './my-work';
import type { MyWorkCard } from './types';

const now = new Date('2026-11-04T10:00:00Z'); // 15:30 in Kolkata.
const tz = 'Asia/Kolkata';
function card(id: string, dueAt: string | null = null, dueCompletedAt: string | null = null): MyWorkCard {
  return { id, dueAt, dueCompletedAt, listId: 'l', boardId: 'b', projectId: 'p', homeProjectId: 'p', key: 'P', number: 1, title: id, position: 1, hasDescription: false, archivedAt: null, assignees: [], labels: [], commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0, projectName: 'Website', projectIcon: 'folder', projectColor: 'green', listName: 'To do' };
}

describe('groupMyWork', () => {
  it('sorts cards into due sections in the person\'s timezone and leaves empty sections out', () => {
    const groups = groupMyWork([
      card('late', '2026-11-03T12:00:00Z'),
      card('tonight', '2026-11-04T18:00:00Z'), // 23:30 Kolkata, still today.
      card('tomorrow', '2026-11-04T19:00:00Z'), // 00:30 Kolkata on the 5th.
      card('next month', '2026-12-04T12:00:00Z'),
      card('undated'),
    ], now, tz);
    expect(groups.map((g) => [g.id, g.cards.map((c) => c.id)])).toEqual([
      ['overdue', ['late']], ['today', ['tonight']], ['next_7_days', ['tomorrow']], ['later', ['next month']], ['none', ['undated']],
    ]);
  });

  it('shows the most recently ticked done card first', () => {
    const groups = groupMyWork([
      card('older', '2026-11-01T12:00:00Z', '2026-11-01T12:00:00Z'),
      card('newer', '2026-10-30T12:00:00Z', '2026-11-03T12:00:00Z'),
    ], now, tz);
    expect(groups).toEqual([{ id: 'done', name: 'Done', cards: [expect.objectContaining({ id: 'newer' }), expect.objectContaining({ id: 'older' })] }]);
  });
});

describe('previewToggle', () => {
  it('ticks a card done, giving an undated one today', () => {
    expect(previewToggle(card('a'), true, now, undefined)).toMatchObject({ dueAt: now.toISOString(), dueCompletedAt: now.toISOString() });
    expect(previewToggle(card('b', '2026-11-03T12:00:00Z'), true, now, undefined)).toMatchObject({ dueAt: '2026-11-03T12:00:00Z' });
  });

  it('reopens a card, restoring the date it had before this page ticked it', () => {
    const done = card('a', now.toISOString(), now.toISOString());
    expect(previewToggle(done, false, now, null)).toMatchObject({ dueAt: null, dueCompletedAt: null });
    expect(previewToggle(done, false, now, undefined)).toMatchObject({ dueAt: now.toISOString(), dueCompletedAt: null });
  });
});
