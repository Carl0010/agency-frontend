import { mergeDetail, moveCardLocal, moveListLocal, removeFromList, shareTile, upsertCard, upsertList } from './board-state';
import type { Board, CardDetail, CardTile } from './types';

function tile(id: string, listId: string, position: number): CardTile {
  return {
    id, listId, boardId: 'b', projectId: 'p', homeProjectId: 'p', key: 'P', number: 1, title: id, position, hasDescription: false, dueAt: null,
    dueCompletedAt: null, archivedAt: null, assignees: [], labels: [], commentCount: 0, attachmentCount: 0,
    checklistDone: 0, checklistTotal: 0,
  };
}

const board: Board = {
  id: 'b', name: 'Board', projectId: 'p', boards: null,
  project: { id: 'p', name: 'P', icon: 'folder', key: 'P', color: 'blue', workspaceId: 'w', archivedAt: null },
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

describe('a card in several projects', () => {
  // The same card drawn on another project's board: its own list there, its shared fields everywhere.
  const elsewhere = (over: Partial<CardTile> = {}): CardTile => ({ ...tile('b', 'launch-week', 99), boardId: 'launch', projectId: 'launch-p', title: 'Renamed', ...over });

  it('a tile drawn on another board refreshes the card in its place here', () => {
    const next = shareTile(board, elsewhere());
    expect(ids(next, 0)).toEqual(['a', 'b', 'c']);
    expect(next.lists[0]?.cards[1]).toMatchObject({ id: 'b', title: 'Renamed', listId: 'todo', boardId: 'b', projectId: 'p', position: 2048 });
  });

  it('never adds a card this board does not show, and an archived card leaves every board', () => {
    expect(shareTile(board, { ...elsewhere(), id: 'zz' })).toBe(board);
    expect(ids(shareTile(board, elsewhere({ archivedAt: '2026-10-21T00:00:00Z' })), 0)).toEqual(['a', 'c']);
  });

  it('a tile for this board is applied in full', () => {
    expect(ids(shareTile(board, tile('b', 'done', 1)), 2)).toEqual(['b']);
  });

  it('card.removed drops the card from the board that has the list only', () => {
    expect(ids(removeFromList(board, 'b', 'todo'), 0)).toEqual(['a', 'c']);
    expect(removeFromList(board, 'b', 'launch-week')).toBe(board);
  });

  it('a detail keeps its placement unless the tile is drawn in its project', () => {
    const detail = { ...tile('b', 'todo', 2048), description: null, listName: 'To do' } as unknown as CardDetail;
    expect(mergeDetail(detail, elsewhere())).toMatchObject({ title: 'Renamed', listId: 'todo', projectId: 'p', boardId: 'b' });
    expect(mergeDetail(detail, tile('b', 'done', 1))).toMatchObject({ listId: 'done', position: 1 });
  });
});
