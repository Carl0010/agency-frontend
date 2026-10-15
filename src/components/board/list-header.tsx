'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { upsertList } from '@/lib/board-state';
import type { Board, BoardList } from '@/lib/types';

/** The same 60px list heading, counts and actions in Kanban and List views. */
export function ListHeader({ list, count, boardId, leading }: {
  list: BoardList; count: number; boardId: string; leading?: ReactNode;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  async function rename(name: string) {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === list.name) return;
    try {
      const view = await api.patch<{ id: string; boardId: string; name: string; position: number }>(`/lists/${list.id}`, { name: trimmed });
      qc.setQueryData<Board>(['board', boardId], (board) => board ? upsertList(board, view) : board);
    } catch (error) { toast(errorMessage(error)); }
  }
  async function archive() {
    menu.current?.hidePopover();
    if (!window.confirm(`Archive “${list.name}” and its ${list.cards.length} cards?`)) return;
    try { await api.del(`/lists/${list.id}`); await qc.invalidateQueries({ queryKey: ['board', boardId] }); }
    catch (error) { toast(errorMessage(error)); }
  }
  return <header data-testid="list-header" className="flex h-15 shrink-0 items-center gap-2 px-3 py-3">
    {leading}
    {editing ? <Input autoFocus defaultValue={list.name} aria-label="List name" maxLength={120}
      onBlur={(event) => void rename(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setEditing(false); }}
      className="min-w-0 flex-1 px-2 py-1.5 text-sm font-semibold" />
      : <h2 className="min-w-0 flex-1"><button type="button" onClick={() => setEditing(true)} title={list.name} className="tap min-h-9 w-full truncate rounded-md text-left text-sm font-semibold tracking-normal hover:bg-muted">{list.name}</button></h2>}
    <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-1.5 text-caption font-medium text-secondary-foreground" aria-label={`${count} of ${list.cards.length} cards`}>
      {count === list.cards.length ? count : `${count}/${list.cards.length}`}
    </span>
    <button type="button" aria-label={`List actions for ${list.name}`} popoverTarget={menuId} onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 128)), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) });
    }} className="tap inline-flex min-h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:bg-surface"><Icon name="more" /></button>
    <div ref={menu} id={menuId} popover="auto" role="group" aria-label={`Actions for ${list.name}`} style={position} className="fixed m-0 w-40 rounded-lg border border-border bg-surface p-1 text-sm text-foreground shadow-lg">
      <button type="button" className="ui-nav-link tap w-full" onClick={() => { menu.current?.hidePopover(); setEditing(true); }}>Rename</button>
      <button type="button" className="ui-nav-link tap w-full text-danger-text" onClick={() => void archive()}>Archive list</button>
    </div>
  </header>;
}
