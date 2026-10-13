import type { Board, BoardList, CardTile } from './types';

/**
 * Immutable board-cache operations shared by drag-and-drop (optimistic moves)
 * and realtime events, so a local drop and a remote move land identically.
 */

const byPosition = (a: { position: number; id: string }, b: { position: number; id: string }) =>
  a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Inserts or replaces a tile in its list, removing it from wherever it was. Archived tiles are removed. */
export function upsertCard(board: Board, tile: CardTile): Board {
  if (tile.boardId !== board.id) return removeCard(board, tile.id);
  return {
    ...board,
    lists: board.lists.map((l) => {
      const rest = l.cards.filter((c) => c.id !== tile.id);
      if (l.id !== tile.listId || tile.archivedAt) return rest.length === l.cards.length ? l : { ...l, cards: rest };
      return { ...l, cards: [...rest, tile].sort(byPosition) };
    }),
  };
}

export function removeCard(board: Board, cardId: string): Board {
  return {
    ...board,
    lists: board.lists.map((l) =>
      l.cards.some((c) => c.id === cardId) ? { ...l, cards: l.cards.filter((c) => c.id !== cardId) } : l,
    ),
  };
}

export function findCard(board: Board, cardId: string): { list: BoardList; index: number; card: CardTile } | null {
  for (const list of board.lists) {
    const index = list.cards.findIndex((c) => c.id === cardId);
    const card = list.cards[index];
    if (card) return { list, index, card };
  }
  return null;
}

/**
 * Moves a card to `index` within `toListId` (index counted with the card
 * removed). Returns the new board and the `beforeCardId` the API needs —
 * the card's new next sibling, or null for the end of the list.
 */
export function moveCardLocal(
  board: Board,
  cardId: string,
  toListId: string,
  index: number,
): { board: Board; beforeCardId: string | null } | null {
  const found = findCard(board, cardId);
  const target = board.lists.find((l) => l.id === toListId);
  if (!found || !target) return null;
  const siblings = target.cards.filter((c) => c.id !== cardId);
  const at = Math.max(0, Math.min(index, siblings.length));
  const before = siblings[at] ?? null;
  const prev = siblings[at - 1] ?? null;
  // A provisional position keeps local sort order stable until the server's tile arrives.
  const position =
    before && prev ? (before.position + prev.position) / 2 : before ? before.position - 1 : prev ? prev.position + 1 : 1024;
  const moved: CardTile = { ...found.card, listId: toListId, position };
  const nextSiblings = [...siblings.slice(0, at), moved, ...siblings.slice(at)];
  return {
    board: {
      ...board,
      lists: board.lists.map((l) => {
        if (l.id === toListId) return { ...l, cards: nextSiblings };
        if (l.id === found.list.id) return { ...l, cards: l.cards.filter((c) => c.id !== cardId) };
        return l;
      }),
    },
    beforeCardId: before?.id ?? null,
  };
}

/** Moves a list to `index`; returns the `beforeListId` the API needs. */
export function moveListLocal(board: Board, listId: string, index: number): { board: Board; beforeListId: string | null } | null {
  const list = board.lists.find((l) => l.id === listId);
  if (!list) return null;
  const rest = board.lists.filter((l) => l.id !== listId);
  const at = Math.max(0, Math.min(index, rest.length));
  const before = rest[at] ?? null;
  return { board: { ...board, lists: [...rest.slice(0, at), list, ...rest.slice(at)] }, beforeListId: before?.id ?? null };
}

/** Applies a list event: replaces name/position and re-sorts, or appends a new empty list. */
export function upsertList(board: Board, list: { id: string; name: string; position: number }): Board {
  const existing = board.lists.find((l) => l.id === list.id);
  const next = existing
    ? board.lists.map((l) => (l.id === list.id ? { ...l, name: list.name, position: list.position } : l))
    : [...board.lists, { ...list, cards: [] }];
  return { ...board, lists: next.sort(byPosition) };
}

export function removeList(board: Board, listId: string): Board {
  return { ...board, lists: board.lists.filter((l) => l.id !== listId) };
}
