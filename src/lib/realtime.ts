'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken, onAccessToken, refreshSession } from './api';
import { removeList, upsertCard, upsertList } from './board-state';
import type { Board, CardDetail, CardTile, Comment } from './types';

/**
 * One socket per tab, authenticated at the handshake with the in-memory
 * access token. Rooms are joined by asking the server, which re-checks access
 * (AC21) — the client never decides what it may hear.
 */

let socket: Socket | null = null;
/** Rooms are ref-counted: a card modal and the board under it share one subscription. */
const roomRefs = new Map<string, number>();

function wsUrl(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? `${window.location.protocol}//${window.location.hostname}:4100`;
}

export function getSocket(): Socket {
  if (socket) return socket;
  const s = io(wsUrl(), {
    path: '/ws',
    transports: ['websocket'],
    // Read on every (re)connect so a rotated token is picked up.
    auth: (cb) => cb({ token: getAccessToken() ?? '' }),
  });
  s.on('connect_error', (err) => {
    if (err.message === 'unauthenticated') {
      void refreshSession().then((res) => {
        if (res) s.connect();
      });
    }
  });
  // The server drops a socket when the user's access changes (a guest
  // downgraded or revoked, §6.3). Reconnect: every room is re-joined through
  // the server's access check, so the room set can only shrink to what is
  // still allowed.
  s.on('disconnect', (reason) => {
    if (reason === 'io server disconnect' && getAccessToken()) setTimeout(() => s.connect(), 300);
  });
  onAccessToken((token) => {
    if (!token) s.disconnect();
    else if (!s.connected) s.connect();
  });
  socket = s;
  return s;
}

const boardQueries = (qc: QueryClient) => qc.getQueryCache().findAll({ queryKey: ['board'] });

/** Writes a fresh tile into the board and card caches. Used by realtime and by local mutations. */
export function applyTile(qc: QueryClient, tile: CardTile): void {
  qc.setQueryData<Board>(['board', tile.boardId], (b) => (b ? upsertCard(b, tile) : b));
  qc.setQueryData<CardDetail>(['card', tile.id], (c) => (c ? { ...c, ...tile } : c));
}

export function applyComment(qc: QueryClient, comment: Comment): void {
  qc.setQueryData<Comment[]>(['comments', comment.cardId], (list) => {
    if (!list) return list;
    return list.some((c) => c.id === comment.id)
      ? list.map((c) => (c.id === comment.id ? comment : c))
      : [...list, comment];
  });
}

/** Subscribes this tab to a project's board events for as long as the component is mounted. */
export function useProjectRealtime(projectId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;
    const s = getSocket();
    const room = `project:${projectId}:board`;
    let resync: ReturnType<typeof setTimeout> | null = null;
    // Positions may be renormalised server-side; a debounced refetch re-aligns sibling positions.
    const scheduleResync = () => {
      if (resync) clearTimeout(resync);
      resync = setTimeout(() => void qc.invalidateQueries({ queryKey: ['board'] }), 400);
    };

    roomRefs.set(room, (roomRefs.get(room) ?? 0) + 1);
    const join = () => {
      s.emit('join', { room }, (ack: { ok: boolean }) => {
        if (!ack.ok) {
          void qc.resetQueries({ queryKey: ['project', projectId] });
          void qc.invalidateQueries({ queryKey: ['projects'] });
        }
        // A failed rejoin must also remove the old board snapshot.
        if (!ack.ok) void qc.resetQueries({ queryKey: ['board'] });
        else void qc.invalidateQueries({ queryKey: ['board'] });
      });
    };
    const onTile = ({ card }: { card: CardTile }) => {
      applyTile(qc, card);
      void qc.invalidateQueries({ queryKey: ['card', card.id] });
    };
    const onMoved = ({ card }: { card: CardTile }) => {
      applyTile(qc, card);
      scheduleResync();
    };
    const onList = ({ list }: { list: { id: string; boardId: string; name: string; position: number } }) => {
      qc.setQueryData<Board>(['board', list.boardId], (b) => (b ? upsertList(b, list) : b));
    };
    const onListArchived = ({ listId }: { listId: string }) => {
      for (const q of boardQueries(qc)) qc.setQueryData<Board>(q.queryKey, (b) => (b ? removeList(b, listId) : b));
    };
    const onComment = ({ comment, card }: { comment: Comment; card: CardTile }) => {
      applyTile(qc, card);
      applyComment(qc, comment);
    };
    const onCardChanged = ({ card }: { card: CardTile }) => {
      applyTile(qc, card);
      void qc.invalidateQueries({ queryKey: ['card', card.id] });
    };

    // Socket payloads are untyped at the wire; the server builds them from the same view types.
    const typed =
      <T,>(fn: (payload: T) => void) =>
      (payload: unknown) =>
        fn(payload as T);
    const handlers: [string, (payload: unknown) => void][] = [
      ['card.created', typed(onTile)],
      ['card.updated', typed(onTile)],
      ['card.archived', typed(onTile)],
      ['card.restored', typed(onTile)],
      ['card.moved', typed(onMoved)],
      ['list.created', typed(onList)],
      ['list.updated', typed(onList)],
      ['list.moved', typed(onList)],
      ['list.archived', typed(onListArchived)],
      ['comment.created', typed(onComment)],
      ['comment.updated', typed(onComment)],
      ['comment.deleted', typed(onComment)],
      ['checklist.changed', typed(onCardChanged)],
      ['attachment.changed', typed(onCardChanged)],
    ];
    for (const [event, fn] of handlers) s.on(event, fn);
    s.on('connect', join);
    if (s.connected) join();

    return () => {
      if (resync) clearTimeout(resync);
      for (const [event, fn] of handlers) s.off(event, fn);
      s.off('connect', join);
      const left = (roomRefs.get(room) ?? 1) - 1;
      if (left > 0) roomRefs.set(room, left);
      else {
        roomRefs.delete(room);
        s.emit('leave', { room });
      }
    };
  }, [projectId, qc]);
}

// ---------------------------------------------------------------------------
// Generic rooms (channel:{id}, card:{id}) and per-user events
// ---------------------------------------------------------------------------

let pinger: ReturnType<typeof setInterval> | null = null;

/** Re-stamps "currently viewing" for channel/card rooms so the server skips push for them (§4.1). */
function ensurePinger(s: Socket): void {
  if (pinger) return;
  pinger = setInterval(() => {
    const viewing = [...roomRefs.keys()].some((r) => r.startsWith('channel:') || r.startsWith('card:'));
    if (viewing && s.connected) s.emit('presence.ping');
  }, 30_000);
}

/**
 * Joins `room` while mounted and routes the given events to `handlers`.
 * `onJoin` runs after every (re)join so callers can refetch what they missed.
 */
export function useRoom(
  room: string | null,
  handlers: Record<string, (payload: never) => void>,
  onJoin?: () => void,
): void {
  const qc = useQueryClient();
  // Handlers change every render; keep the latest without re-subscribing.
  const ref = useRef({ handlers, onJoin });
  ref.current = { handlers, onJoin };
  const events = Object.keys(handlers).sort().join('|');

  useEffect(() => {
    if (!room) return;
    const s = getSocket();
    ensurePinger(s);
    roomRefs.set(room, (roomRefs.get(room) ?? 0) + 1);
    const join = () => {
      s.emit('join', { room }, (ack: { ok: boolean }) => {
        if (!ack.ok) {
          for (const key of ['project', 'card', 'channels', 'projects']) void qc.resetQueries({ queryKey: [key] });
        }
        ref.current.onJoin?.();
      });
    };
    const bound = events
      .split('|')
      .filter(Boolean)
      .map((event) => {
        const fn = (payload: unknown) => (ref.current.handlers[event] as ((p: unknown) => void) | undefined)?.(payload);
        s.on(event, fn);
        return [event, fn] as const;
      });
    s.on('connect', join);
    if (s.connected) join();
    return () => {
      for (const [event, fn] of bound) s.off(event, fn);
      s.off('connect', join);
      const left = (roomRefs.get(room) ?? 1) - 1;
      if (left > 0) roomRefs.set(room, left);
      else {
        roomRefs.delete(room);
        s.emit('leave', { room });
      }
    };
  }, [room, events, qc]);
}

/** Listens to an event on this user's own room (`user:{id}`, joined by the server at connect). */
export function useUserEvent<T>(event: string, handler: (payload: T) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = getSocket();
    const fn = (payload: unknown) => ref.current(payload as T);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
  }, [event]);
}

/** Emits on the shared socket (typing indicators). */
export function emit(event: string, payload: Record<string, unknown>): void {
  const s = getSocket();
  if (s.connected) s.emit(event, payload);
}
