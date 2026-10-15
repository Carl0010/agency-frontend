'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { Button, Input, Textarea } from '@/components/ui';
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
      className={`max-h-full min-h-64 w-full shrink-0 flex-col rounded-xl border border-border bg-subtle sm:w-80 ${sortable.isDragging ? 'opacity-40' : ''} ${className}`}
    >
      <header className="flex shrink-0 items-center gap-2 px-3 py-3">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Move list ${list.name}`}
          disabled={dndDisabled}
          className="tap hidden min-h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-secondary-foreground disabled:cursor-default disabled:opacity-40 sm:inline-flex"
        >
          <Icon name="grip" className="size-3.5" />
        </button>
        {editing ? (
          <Input
            autoFocus
            defaultValue={list.name}
            aria-label="List name"
            maxLength={120}
            onBlur={(e) => void rename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="min-w-0 flex-1 rounded border border-ring px-2 py-1.5 text-sm font-semibold"
          />
        ) : (
          <h2 className="min-w-0 flex-1">
            <button type="button" onClick={() => setEditing(true)} title={list.name} className="tap min-h-9 w-full truncate rounded-md text-left text-sm font-semibold tracking-normal hover:bg-muted">
              {list.name}
            </button>
          </h2>
        )}
        <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-1.5 text-caption font-medium text-secondary-foreground" aria-label={`${cards.length} of ${list.cards.length} cards`}>
          {cards.length === list.cards.length ? list.cards.length : `${cards.length}/${list.cards.length}`}
        </span>
        <div className="relative">
          <button type="button" aria-label={`List actions for ${list.name}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="tap inline-flex min-h-9 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:bg-surface">
            <Icon name="more" />
          </button>
          {menu ? (
            <div className="absolute right-0 z-20 mt-1 w-40 rounded-md border border-border bg-surface py-1 text-sm shadow-lg">
              <button type="button" className="tap block w-full px-3 py-1.5 text-left hover:bg-subtle" onClick={() => { setMenu(false); setEditing(true); }}>
                Rename
              </button>
              <button type="button" className="tap block w-full px-3 py-1.5 text-left text-danger-text hover:bg-subtle" onClick={() => void archive()}>
                Archive list
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div ref={drop.setNodeRef} data-testid="list-cards" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 pb-1">
        {cards.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-caption text-muted-foreground">{list.cards.length ? 'No matching cards' : 'No cards yet'}</p> : null}
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} projectKey={board.project.key} now={now} href={cardHref(c.id)} disabled={dndDisabled} />
          ))}
        </SortableContext>
      </div>
      <AddCard listId={list.id} boardId={board.id} />
    </section>
  );
}

function AddCard({ listId, boardId }: { listId: string; boardId: string }) {
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
      const tile = await api.post<CardTile>(`/lists/${listId}/cards`, { title: t, at: 'end' });
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
        data-testid="add-card-end"
        data-tour="add-card"
        className="tap mx-3 mb-3 mt-2 min-h-9 shrink-0 rounded-md px-3 py-2 text-left text-label font-medium text-secondary-foreground hover:bg-muted active:bg-surface"
      >
        <span className="inline-flex items-center gap-2"><Icon name="plus" />Add card</span>
      </button>
    );
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="mx-3 mb-3 mt-2 shrink-0 space-y-2">
      <Textarea
        autoFocus
        rows={2}
        value={title}
        maxLength={500}
        aria-label="Card title"
        placeholder="Card title — Enter to add"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-20 resize-none"
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} size="sm">
          Add
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
