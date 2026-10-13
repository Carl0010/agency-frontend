'use client';

import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { ProjectRail, ProjectTabs } from '@/components/project-chrome';
import { useToast } from '@/components/toast';
import { Avatar, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { findCard, moveCardLocal, moveListLocal, upsertCard, upsertList } from '@/lib/board-state';
import { isFiltering, matchesFilters, parseFilters, writeFilters, type BoardFilters } from '@/lib/filters';
import { useProjectRealtime } from '@/lib/realtime';
import type { Board, CardTile, Label, Member, Page } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';
import { formText } from '@/lib/form';
import { CardTileView } from './card-tile';
import { FilterBar } from './filter-bar';
import { ListColumn } from './list-column';

type Drag = { type: 'card' | 'list'; activeId: string; board: Board; snapshot: Board };

const listIdOf = (id: string) => id.replace(/^(list|cards):/, '');

/** Resolves a drop target to (list, index-in-list). Containers mean "end of list". */
function resolveOver(board: Board, overId: string): { listId: string; index: number } | null {
  if (overId.startsWith('list:') || overId.startsWith('cards:')) {
    const list = board.lists.find((l) => l.id === listIdOf(overId));
    return list ? { listId: list.id, index: list.cards.length } : null;
  }
  const found = findCard(board, overId);
  return found ? { listId: found.list.id, index: found.index } : null;
}

/** Lists only collide with lists; cards collide with cards and list bodies. */
const collision: CollisionDetection = (args) => {
  const isList = args.active.data.current?.type === 'list';
  const droppableContainers = args.droppableContainers.filter((c) => (c.data.current?.type === 'list') === isList);
  return isList ? closestCenter({ ...args, droppableContainers }) : closestCorners({ ...args, droppableContainers });
};

export function BoardScreen({ boardId, projectId }: { boardId: string; projectId: string }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [mobileListId, setMobileListId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  useProjectRealtime(projectId);
  const board = useQuery({ queryKey: ['board', boardId], queryFn: () => api.get<Board>(`/boards/${boardId}`) });
  const members = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });
  const labels = useQuery({ queryKey: ['labels', ws.id], queryFn: () => api.get<Page<Label>>(`/workspaces/${ws.id}/labels`) });

  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const setFilters = (f: BoardFilters) => {
    const next = writeFilters(new URLSearchParams(params.toString()), f).toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const filtering = isFiltering(filters);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press then drag on touch, so scrolling the board still works (§3.7).
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Space lifts, arrows move, Space drops, Esc cancels (AC14). Enter is left free to open a card.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  if (board.isPending) return <Spinner />;
  if (board.error) return <p className="p-8 text-center text-slate-600">{errorMessage(board.error)}</p>;

  const shown = drag?.board ?? board.data;
  const qs = params.toString();
  const cardHref = (cardId: string) => `/w/${ws.slug}/p/${projectId}/b/${boardId}/c/${cardId}${qs ? `?${qs}` : ''}`;
  const activeMembers = (members.data?.data ?? []).filter((m) => m.status === 'active' && m.role !== 'guest');
  const totalCards = shown.lists.reduce((n, l) => n + l.cards.length, 0);
  const selectedList = shown.lists.find((l) => l.id === mobileListId) ?? shown.lists[0];

  function onDragStart(e: DragStartEvent) {
    const current = qc.getQueryData<Board>(['board', boardId]);
    if (!current) return;
    const type = e.active.data.current?.type === 'list' ? 'list' : 'card';
    setDrag({ type, activeId: type === 'list' ? listIdOf(String(e.active.id)) : String(e.active.id), board: current, snapshot: current });
  }

  function onDragOver(e: DragOverEvent) {
    if (!drag || drag.type !== 'card' || !e.over) return;
    const from = findCard(drag.board, drag.activeId);
    const to = resolveOver(drag.board, String(e.over.id));
    // Cross-list moves are applied live so the target list opens a gap; same-list order is handled by the sortable.
    if (!from || !to || to.listId === from.list.id) return;
    const moved = moveCardLocal(drag.board, drag.activeId, to.listId, to.index);
    if (moved) setDrag({ ...drag, board: moved.board });
  }

  function onDragEnd(e: DragEndEvent) {
    const d = drag;
    setDrag(null);
    if (!d || !e.over) return;
    if (d.type === 'card') void commitCardMove(d, String(e.over.id));
    else void commitListMove(d, String(e.over.id));
  }

  async function commitCardMove(d: Drag, overId: string) {
    const to = resolveOver(d.board, overId);
    if (!to) return;
    const result = moveCardLocal(d.board, d.activeId, to.listId, to.index);
    const before = findCard(d.snapshot, d.activeId);
    if (!result || !before) return;
    const originalNext = before.list.cards[before.index + 1]?.id ?? null;
    if (before.list.id === to.listId && originalNext === result.beforeCardId) return;
    // Optimistic: show the drop immediately; a failure restores the snapshot (AC12).
    qc.setQueryData(['board', boardId], result.board);
    try {
      const tile = await api.patch<CardTile>(`/cards/${d.activeId}/move`, { listId: to.listId, beforeCardId: result.beforeCardId });
      qc.setQueryData<Board>(['board', boardId], (b) => (b ? upsertCard(b, tile) : b));
    } catch (err) {
      qc.setQueryData(['board', boardId], d.snapshot);
      toast(`Couldn't move the card: ${errorMessage(err)} It's back where it was.`);
    } finally {
      void qc.invalidateQueries({ queryKey: ['board', boardId] });
    }
  }

  async function commitListMove(d: Drag, overId: string) {
    const overList = overId.startsWith('list:') || overId.startsWith('cards:') ? listIdOf(overId) : findCard(d.board, overId)?.list.id;
    const index = d.board.lists.findIndex((l) => l.id === overList);
    const from = d.board.lists.findIndex((l) => l.id === d.activeId);
    if (index < 0 || from < 0 || index === from) return;
    const result = moveListLocal(d.board, d.activeId, index);
    if (!result) return;
    qc.setQueryData(['board', boardId], result.board);
    try {
      const view = await api.patch<{ id: string; boardId: string; name: string; position: number }>(`/lists/${d.activeId}/position`, {
        beforeListId: result.beforeListId,
      });
      qc.setQueryData<Board>(['board', boardId], (b) => (b ? upsertList(b, view) : b));
    } catch (err) {
      qc.setQueryData(['board', boardId], d.snapshot);
      toast(`Couldn't move the list: ${errorMessage(err)}`);
    } finally {
      void qc.invalidateQueries({ queryKey: ['board', boardId] });
    }
  }

  const activeCard = drag?.type === 'card' ? findCard(drag.board, drag.activeId)?.card : undefined;
  const activeList = drag?.type === 'list' ? drag.board.lists.find((l) => l.id === drag.activeId) : undefined;

  return (
    <div className="flex h-full">
      <ProjectRail open={railOpen} onClose={() => setRailOpen(false)} currentProjectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <button type="button" aria-label="Projects" onClick={() => setRailOpen(true)} className="tap rounded px-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold" data-testid="board-title">
              {shown.project.name}
            </h1>
            {shown.project.clientName ? <p className="truncate text-xs text-slate-500">{shown.project.clientName}</p> : null}
          </div>
          <div className="ml-2">
            <ProjectTabs projectId={projectId} boardId={boardId} current="board" />
          </div>
          <div className="ml-auto flex -space-x-1.5">
            {activeMembers.slice(0, 5).map((m) => (
              <Avatar key={m.userId} person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={26} />
            ))}
          </div>
          <ArchivedCards boardId={boardId} cardHref={cardHref} />
        </div>
        <FilterBar filters={filters} onChange={setFilters} members={activeMembers} labels={labels.data?.data ?? []} />

        {shown.lists.length ? (
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1 sm:hidden" role="tablist" aria-label="Lists">
            {shown.lists.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={l.id === selectedList?.id}
                onClick={() => setMobileListId(l.id)}
                className={`tap shrink-0 rounded-full px-3 text-sm ${l.id === selectedList?.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                {l.name} <span className="opacity-70">{l.cards.length}</span>
              </button>
            ))}
          </div>
        ) : null}

        {totalCards === 0 && !filtering ? (
          <p className="mx-3 mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">Add your first card to get started.</p>
        ) : null}
        {filtering ? <p className="mx-3 mt-2 text-xs text-slate-500">Filters are on — clear them to drag cards.</p> : null}

        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDrag(null)}
        >
          <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3" data-testid="board-lists">
            <SortableContext items={shown.lists.map((l) => `list:${l.id}`)} strategy={horizontalListSortingStrategy}>
              {shown.lists.map((l) => (
                <ListColumn
                  key={l.id}
                  list={l}
                  cards={filtering ? l.cards.filter((c) => matchesFilters(c, filters, now)) : l.cards}
                  board={shown}
                  now={now}
                  cardHref={cardHref}
                  dndDisabled={filtering}
                  className={l.id === selectedList?.id ? 'flex' : 'hidden sm:flex'}
                />
              ))}
            </SortableContext>
            <AddList boardId={boardId} />
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="w-72">
                <CardTileView card={activeCard} projectKey={shown.project.key} now={now} dragging />
              </div>
            ) : activeList ? (
              <div className="w-72 rounded-lg bg-slate-200 p-3 text-sm font-semibold shadow-lg">{activeList.name}</div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function AddList({ boardId }: { boardId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const name = formText(new FormData(formEl), 'name');
    if (!name) return;
    try {
      const view = await api.post<{ id: string; boardId: string; name: string; position: number }>(`/boards/${boardId}/lists`, { name });
      qc.setQueryData<Board>(['board', boardId], (b) => (b ? upsertList(b, view) : b));
      formEl.reset();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return open ? (
    <form onSubmit={(e) => void onSubmit(e)} className="hidden w-72 shrink-0 space-y-2 rounded-lg bg-slate-100 p-2 sm:block">
      <input name="name" autoFocus aria-label="List name" placeholder="List name" maxLength={120} className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" />
      <div className="flex gap-2">
        <button type="submit" className="tap rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white">
          Add list
        </button>
        <button type="button" onClick={() => setOpen(false)} className="tap px-2 text-sm text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="tap hidden w-72 shrink-0 rounded-lg bg-slate-200/60 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200 sm:block">
      + Add list
    </button>
  );
}

function ArchivedCards({ boardId, cardHref }: { boardId: string; cardHref: (id: string) => string }) {
  const [open, setOpen] = useState(false);
  const archived = useQuery({
    queryKey: ['archived', boardId],
    queryFn: () => api.get<Page<CardTile>>(`/boards/${boardId}/archived-cards`),
    enabled: open,
  });
  return (
    <div className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="tap rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100">
        Archived
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 max-h-96 w-72 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {archived.isPending ? (
            <Spinner />
          ) : archived.data?.data.length ? (
            <ul className="space-y-1">
              {archived.data.data.map((c) => (
                <li key={c.id}>
                  <Link href={cardHref(c.id)} onClick={() => setOpen(false)} className="tap block truncate rounded px-2 py-1 text-sm hover:bg-slate-100">
                    #{c.number} {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-2 text-sm text-slate-500">No archived cards.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
