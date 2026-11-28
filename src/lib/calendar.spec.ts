import { cardsByDay, localDateKey, monthGrid, monthParam, moveDueToDay, parseMonth, shiftMonth } from './calendar';
import type { CardTile } from './types';

const card = (id: string, dueAt: string | null, position = 1): CardTile => ({
  id, listId: 'l', boardId: 'b', projectId: 'p', homeProjectId: 'p', key: 'WEB', number: 1, title: id, position,
  hasDescription: false, dueAt, dueCompletedAt: null, archivedAt: null, assignees: [], labels: [],
  commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0,
});

describe('calendar month', () => {
  const now = new Date('2026-11-30T20:00:00Z'); // Dec 1, 01:30 in Kolkata

  it('defaults to the month that contains today in the profile timezone', () => {
    expect(parseMonth(null, now, 'Asia/Kolkata')).toEqual({ year: 2026, month: 12 });
    expect(parseMonth(null, now, 'America/New_York')).toEqual({ year: 2026, month: 11 });
  });

  it('reads valid month parameters and ignores others', () => {
    expect(parseMonth('2027-02', now, 'UTC')).toEqual({ year: 2027, month: 2 });
    expect(parseMonth('2027-13', now, 'UTC')).toEqual({ year: 2026, month: 11 });
    expect(parseMonth('soon', now, 'UTC')).toEqual({ year: 2026, month: 11 });
  });

  it('steps across years', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthParam({ year: 2027, month: 3 })).toBe('2027-03');
  });

  it('covers the month in whole Sunday-first weeks', () => {
    const weeks = monthGrid({ year: 2026, month: 11 }); // Nov 1, 2026 is a Sunday
    expect(weeks).toHaveLength(5);
    expect(weeks[0]![0]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
    expect(weeks[4]![6]).toEqual({ date: '2026-12-05', day: 5, inMonth: false });
    const feb = monthGrid({ year: 2026, month: 2 }); // starts on a Sunday, 28 days
    expect(feb).toHaveLength(4);
    expect(monthGrid({ year: 2026, month: 8 })).toHaveLength(6);
    expect(monthGrid({ year: 2026, month: 12 })[0]![0]!.date).toBe('2026-11-29');
  });
});

describe('cards on days', () => {
  it('places cards on their local due day, by time then board order', () => {
    const cards = [card('late', '2026-11-28T15:00:00Z'), card('none', null), card('early', '2026-11-28T03:00:00Z'), card('next', '2026-11-28T19:00:00Z')];
    const days = cardsByDay(cards, 'Asia/Kolkata');
    expect(days.get('2026-11-28')!.map((c) => c.id)).toEqual(['early', 'late']);
    expect(days.get('2026-11-29')!.map((c) => c.id)).toEqual(['next']);
    expect([...days.values()].flat()).toHaveLength(3);
  });

  it('keeps the local time of day when a card moves to another day', () => {
    expect(moveDueToDay('2026-11-28T12:29:59.000Z', '2026-12-03', 'Asia/Kolkata')).toBe('2026-12-03T12:29:59.000Z');
    expect(localDateKey(new Date(moveDueToDay('2026-11-28T18:29:59.000Z', '2026-11-25', 'Asia/Kolkata')), 'Asia/Kolkata')).toBe('2026-11-25');
  });

  it('uses calendar days across a DST change', () => {
    // 9:00 in New York before and after clocks go back on Nov 1, 2026.
    expect(moveDueToDay('2026-10-30T13:00:00.000Z', '2026-11-03', 'America/New_York')).toBe('2026-11-03T14:00:00.000Z');
  });
});
