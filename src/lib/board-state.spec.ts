import { moveCardLocal, moveListLocal, upsertCard, upsertList } from './board-state';
import type { Board, CardTile } from './types';

function tile(id: string, listId: string, position: number): CardTile {
  return {
    id, listId, boardId: 'b', projectId: 'p', number: 1, title: id, position, hasDescription: false, dueAt: null,
    dueCompletedAt: null, archivedAt: null, assignees: [], labels: [], commentCount: 0, attachmentCount: 0,
    checklistDone: 0, checklistTotal: 0,
  };
}

const board: Board = {
  id: 'b', name: 'Board', projectId: 'p', boards: null,
  project: { id: 'p', name: 'P', clientName: null, key: 'P', color: 'blue', workspaceId: 'w', archivedAt: null },
  lists: [
    { id: 'todo', name: 'To do', position: 1024, cards: [tile('a', 'todo', 1024), tile('b', 'todo', 2048), tile('c', 'todo', 3072)] },
    { id: 'doing', name: 'Doing', position: 2048, cards: [tile('d', 'doing', 1024)] },
    { id: 'done', name: 'Done', position: 3072, cards: [] },
  ],
};
const ids = (b: Board, list: number) => b.lists[list]?.cards.map((c) => c.id);

describe('moveCardLocal', () => {
  it('within a list: before-sibling is the new next card', () => {
    const r = moveCardLocal(board, 'a', 'todo', 1);
    expect(ids(r!.board, 0)).toEqual(['b', 'a', 'c']);
    expect(r!.beforeCardId).toBe('c');
  });

  it('to the end of a list sends null', () => {
    const r = moveCardLocal(board, 'a', 'todo', 99);
    expect(ids(r!.board, 0)).toEqual(['b', 'c', 'a']);
    expect(r!.beforeCardId).toBeNull();
  });

  it('across lists, including into an empty one', () => {
    const r = moveCardLocal(board, 'b', 'doing', 0);
    expect(ids(r!.board, 0)).toEqual(['a', 'c']);
    expect(ids(r!.board, 1)).toEqual(['b', 'd']);
    expect(r!.beforeCardId).toBe('d');
    const e = moveCardLocal(board, 'b', 'done', 0);
    expect(ids(e!.board, 2)).toEqual(['b']);
    expect(e!.beforeCardId).toBeNull();
  });

  it('does not mutate the input (a failed move restores the snapshot)', () => {
    const snapshot = JSON.stringify(board);
    moveCardLocal(board, 'a', 'done', 0);
    expect(JSON.stringify(board)).toBe(snapshot);
  });
});

describe('moveListLocal', () => {
  it('reorders and reports the next list', () => {
    const r = moveListLocal(board, 'done', 0);
    expect(r!.board.lists.map((l) => l.id)).toEqual(['done', 'todo', 'doing']);
    expect(r!.beforeListId).toBe('todo');
  });
});

describe('realtime upserts', () => {
  it('a remote move lands in the right list and order', () => {
    const next = upsertCard(board, tile('a', 'doing', 2000));
    expect(ids(next, 0)).toEqual(['b', 'c']);
    expect(ids(next, 1)).toEqual(['d', 'a']);
  });

  it('an archived tile disappears; a restored one comes back', () => {
    const archived = upsertCard(board, { ...tile('b', 'todo', 2048), archivedAt: '2026-10-13T00:00:00Z' });
    expect(ids(archived, 0)).toEqual(['a', 'c']);
    expect(ids(upsertCard(archived, tile('b', 'todo', 2048)), 0)).toEqual(['a', 'b', 'c']);
  });

  it('list events re-sort by position', () => {
    const next = upsertList(board, { id: 'done', name: 'Done', position: 10 });
    expect(next.lists.map((l) => l.id)).toEqual(['done', 'todo', 'doing']);
  });
});
