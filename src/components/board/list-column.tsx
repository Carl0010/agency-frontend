'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { upsertCard, upsertList } from '@/lib/board-state';
import type { Board, BoardList, CardTile } from '@/lib/types';
import { SortableCard } from './card-tile';

interface Props {
  list: BoardList;
  /** Cards after filtering; equals `list.cards` when no filter is active. */
  cards: CardTile[];
  board: Board;
  now: Date;
  cardHref: (cardId: string) => string;
  dndDisabled: boolean;
  className?: string;
}

export function ListColumn({ list, cards, board, now, cardHref, dndDisabled, className = '' }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const sortable = useSortable({ id: `list:${list.id}`, data: { type: 'list' }, disabled: dndDisabled });
  const drop = useDroppable({ id: `cards:${list.id}`, data: { type: 'cards', listId: list.id } });
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);

  async function rename(name: string) {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === list.name) return;
    try {
      const view = await api.patch<{ id: string; boardId: string; name: string; position: number }>(`/lists/${list.id}`, { name: trimmed });
      qc.setQueryData<Board>(['board', board.id], (b) => (b ? upsertList(b, view) : b));
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function archive() {
    setMenu(false);
    if (!window.confirm(`Archive “${list.name}” and its ${list.cards.length} cards?`)) return;
    try {
      await api.del(`/lists/${list.id}`);
      await qc.invalidateQueries({ queryKey: ['board', board.id] });
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-label={`List ${list.name}`}
      data-testid="list-column"
      data-list-id={list.id}
      className={`max-h-full w-full shrink-0 flex-col rounded-xl bg-slate-200/50 sm:w-72 ${sortable.isDragging ? 'opacity-40' : ''} ${className}`}
    >
      <header className="flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Move list ${list.name}`}
          disabled={dndDisabled}
          className="tap hidden cursor-grab rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:cursor-default sm:block"
        >
          ⠿
        </button>
        {editing ? (
          <input
            autoFocus
            defaultValue={list.name}
            aria-label="List name"
            maxLength={120}
            onBlur={(e) => void rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="min-w-0 flex-1 rounded border border-blue-400 px-1 text-sm font-semibold"
          />
        ) : (
          <h2 className="min-w-0 flex-1">
            <button type="button" onClick={() => setEditing(true)} className="tap w-full truncate rounded px-1 text-left text-[13px] font-semibold tracking-tight hover:bg-slate-200">
              {list.name}
            </button>
          </h2>
        )}
        <span className="text-xs text-slate-500" aria-label={`${list.cards.length} cards`}>
          {cards.length === list.cards.length ? list.cards.length : `${cards.length}/${list.cards.length}`}
        </span>
        <div className="relative">
          <button type="button" aria-label={`List actions for ${list.name}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="tap rounded px-1.5 text-slate-500 hover:bg-slate-200">
            ⋯
          </button>
          {menu ? (
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
              <button type="button" className="tap block w-full px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => { setMenu(false); setEditing(true); }}>
                Rename
              </button>
              <button type="button" className="tap block w-full px-3 py-1.5 text-left text-red-700 hover:bg-slate-100" onClick={() => void archive()}>
                Archive list
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <AddCard listId={list.id} boardId={board.id} at="start" />
      <div ref={drop.setNodeRef} className="flex min-h-10 flex-col gap-2 overflow-y-auto px-2 pb-1">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} projectKey={board.project.key} now={now} href={cardHref(c.id)} disabled={dndDisabled} />
          ))}
        </SortableContext>
      </div>
      <AddCard listId={list.id} boardId={board.id} at="end" />
    </section>
  );
}

function AddCard({ listId, boardId, at }: { listId: string; boardId: string; at: 'start' | 'end' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const tile = await api.post<CardTile>(`/lists/${listId}/cards`, { title: t, at });
      qc.setQueryData<Board>(['board', boardId], (b) => (b ? upsertCard(b, tile) : b));
      setTitle('');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
    if (e.key === 'Escape') setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`add-card-${at}`}
        data-tour={at === 'end' ? 'add-card' : undefined}
        className={`tap mx-2 rounded px-2 py-1 text-left text-sm text-slate-600 hover:bg-slate-200 ${at === 'start' ? 'my-1 hidden sm:block' : 'my-2'}`}
      >
        + Add card
      </button>
    );
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="mx-2 my-1 space-y-1">
      <textarea
        autoFocus
        rows={2}
        value={title}
        maxLength={500}
        aria-label="Card title"
        placeholder="Card title — Enter to add"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full resize-none rounded-md border border-slate-300 p-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="tap rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
          Add
        </button>
        <button type="button" onClick={() => setOpen(false)} className="tap rounded-md px-2 text-sm text-slate-600 hover:bg-slate-200">
          Cancel
        </button>
      </div>
    </form>
  );
}
