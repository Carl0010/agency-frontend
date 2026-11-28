import { EMPTY_FILTERS } from './filters';
import { beforeIdAt, groupBySection, moveCardLocal, moveSectionLocal, previewToggle, sectionStep, shownCard } from './my-tasks';
import type { MyTaskCard, MyTasks, MyTaskSection } from './types';

const now = new Date('2026-11-04T10:00:00Z');
const section = (id: string, position: number, kind: MyTaskSection['kind'] = 'custom'): MyTaskSection => ({ id, name: id, kind, position });
function card(id: string, sectionId: string, sectionPosition: number, dueCompletedAt: string | null = null): MyTaskCard {
  return { id, sectionId, sectionPosition, dueAt: dueCompletedAt, dueCompletedAt, listId: 'l', boardId: 'b', projectId: 'p', homeProjectId: 'p', key: 'P', number: 1, title: id, position: 1, hasDescription: false, archivedAt: null, assignees: [], labels: [], commentCount: 0, attachmentCount: 0, checklistDone: 0, checklistTotal: 0, projectName: 'Website', projectIcon: 'folder', projectColor: 'green', listName: 'To do' };
}
const data: MyTasks = {
  sections: [section('later', 3), section('recent', 1, 'recent'), section('today', 2)],
  cards: [card('b', 'recent', 2), card('a', 'recent', 1), card('done', 'today', 1, '2026-11-03T10:00:00Z'), card('c', 'today', 2)],
};
const ids = (d: MyTasks) => groupBySection(d, () => true).map((g) => [g.section.id, g.cards.map((c) => c.id)]);

describe('groupBySection', () => {
  it('keeps the person\'s order of sections and cards', () => {
    expect(ids(data)).toEqual([['recent', ['a', 'b']], ['today', ['done', 'c']], ['later', []]]);
  });

  it('hides done cards until Show completed is on, and counts every card', () => {
    const hidden = groupBySection(data, shownCard(EMPTY_FILTERS, false, now));
    expect(hidden[1]).toMatchObject({ cards: [expect.objectContaining({ id: 'c' })], total: 2 });
    expect(groupBySection(data, shownCard(EMPTY_FILTERS, true, now))[1]?.cards).toHaveLength(2);
  });

  it('applies search like a board', () => {
    expect(groupBySection(data, shownCard({ ...EMPTY_FILTERS, q: 'b' }, false, now)).flatMap((g) => g.cards.map((c) => c.id))).toEqual(['b']);
  });
});

describe('moving', () => {
  it('drops a card before another card, or last', () => {
    expect(ids(moveCardLocal(data, 'c', 'recent', 'b'))[0]).toEqual(['recent', ['a', 'c', 'b']]);
    expect(ids(moveCardLocal(data, 'a', 'later', null))[2]).toEqual(['later', ['a']]);
    expect(ids(moveCardLocal(data, 'a', 'recent', null))[0]).toEqual(['recent', ['b', 'a']]);
  });

  it('finds the card a drop lands before, skipping the moving card', () => {
    const shown = [card('a', 's', 1), card('b', 's', 2), card('c', 's', 3)];
    expect(beforeIdAt(shown, 'a', 1)).toBe('c');
    expect(beforeIdAt(shown, 'x', 0)).toBe('a');
    expect(beforeIdAt(shown, 'x', 3)).toBeNull();
  });

  it('steps a section left or right', () => {
    expect(sectionStep(data.sections, 'today', -1)).toEqual({ beforeId: 'recent' });
    expect(sectionStep(data.sections, 'today', 1)).toEqual({ beforeId: null });
    expect(sectionStep(data.sections, 'recent', 1)).toEqual({ beforeId: 'later' });
    expect(sectionStep(data.sections, 'recent', -1)).toBeNull();
    expect(sectionStep(data.sections, 'later', 1)).toBeNull();
    expect(ids(moveSectionLocal(data, 'later', 'recent')).map(([id]) => id)).toEqual(['later', 'recent', 'today']);
  });
});

describe('previewToggle', () => {
  it('gives an undated card today when ticked and restores its date when reopened', () => {
    const open = card('x', 's', 1);
    const done = previewToggle(open, true, now, undefined);
    expect(done).toMatchObject({ dueAt: now.toISOString(), dueCompletedAt: now.toISOString() });
    expect(previewToggle(done, false, now, null)).toMatchObject({ dueAt: null, dueCompletedAt: null });
  });
});
