import { EMPTY_FILTERS, isFiltering, matchesFilters, parseFilters, writeFilters, type BoardFilters } from './filters';
import type { CardTile } from './types';

const NOW = new Date('2026-10-13T12:00:00Z');
const DAY = 86_400_000;

function card(over: Partial<CardTile>): CardTile {
  return {
    id: 'c1', listId: 'l1', boardId: 'b1', projectId: 'p1', number: 7, title: 'Homepage wireframes', position: 1024,
    hasDescription: false, dueAt: null, dueCompletedAt: null, archivedAt: null, assignees: [], labels: [],
    commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0, ...over,
  };
}
const riya = { id: 'u-riya', name: 'Riya', avatarUrl: null, active: true };
const kim = { id: 'u-kim', name: 'Kim', avatarUrl: null, active: true };
const design = { id: 'lb-design', name: 'Design', color: 'purple' };

describe('URL round trip (survives a reload)', () => {
  it('parses what it writes and keeps unrelated params', () => {
    const f: BoardFilters = { assignees: ['u-riya', 'u-kim'], labels: ['lb-design'], due: 'week', q: 'hero' };
    const params = writeFilters(new URLSearchParams('view=compact'), f);
    expect(params.get('view')).toBe('compact');
    expect(parseFilters(new URLSearchParams(params.toString()))).toEqual(f);
  });

  it('drops empty filters from the URL and ignores junk', () => {
    expect(writeFilters(new URLSearchParams(), EMPTY_FILTERS).toString()).toBe('');
    expect(parseFilters(new URLSearchParams('due=someday&assignee=,'))).toEqual(EMPTY_FILTERS);
    expect(isFiltering(EMPTY_FILTERS)).toBe(false);
  });
});

describe('matchesFilters', () => {
  it('assignee: any selected assignee matches', () => {
    const f = { ...EMPTY_FILTERS, assignees: ['u-riya'] };
    expect(matchesFilters(card({ assignees: [kim, riya] }), f, NOW)).toBe(true);
    expect(matchesFilters(card({ assignees: [kim] }), f, NOW)).toBe(false);
  });

  it('label', () => {
    const f = { ...EMPTY_FILTERS, labels: ['lb-design'] };
    expect(matchesFilters(card({ labels: [design] }), f, NOW)).toBe(true);
    expect(matchesFilters(card({}), f, NOW)).toBe(false);
  });

  it('due: overdue / this week / no date', () => {
    const overdue = card({ dueAt: new Date(NOW.getTime() - DAY).toISOString() });
    const overdueDone = card({ dueAt: overdue.dueAt, dueCompletedAt: NOW.toISOString() });
    const thisWeek = card({ dueAt: new Date(NOW.getTime() + 3 * DAY).toISOString() });
    const later = card({ dueAt: new Date(NOW.getTime() + 10 * DAY).toISOString() });
    const none = card({});
    const by = (due: BoardFilters['due']) =>
      [overdue, overdueDone, thisWeek, later, none].map((c) => matchesFilters(c, { ...EMPTY_FILTERS, due }, NOW));
    expect(by('overdue')).toEqual([true, false, false, false, false]);
    expect(by('week')).toEqual([false, false, true, false, false]);
    expect(by('none')).toEqual([false, false, false, false, true]);
  });

  it('text matches title case-insensitively, or the card number', () => {
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, q: 'WIRE' }, NOW)).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, q: '#7' }, NOW)).toBe(true);
    expect(matchesFilters(card({}), { ...EMPTY_FILTERS, q: 'pricing' }, NOW)).toBe(false);
  });

  it('filters compose with AND', () => {
    const f: BoardFilters = { assignees: ['u-riya'], labels: ['lb-design'], due: null, q: 'home' };
    expect(matchesFilters(card({ assignees: [riya], labels: [design] }), f, NOW)).toBe(true);
    expect(matchesFilters(card({ assignees: [riya] }), f, NOW)).toBe(false);
    expect(matchesFilters(card({ assignees: [riya], labels: [design], title: 'Pricing' }), f, NOW)).toBe(false);
  });
});
