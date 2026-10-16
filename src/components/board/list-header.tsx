'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode, type MouseEvent, type TouchEvent } from 'react';
import type { useSortable } from '@dnd-kit/sortable';
import { useConfirm } from '@/components/confirmation';
import { Icon } from '@/components/icon';
import { Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { upsertList } from '@/lib/board-state';
import type { Board, BoardList } from '@/lib/types';

type HeaderDrag = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners' | 'setActivatorNodeRef' | 'isDragging'> & { disabled: boolean };

/** The same 60px list heading, counts and actions in Kanban and List views. */
export function ListHeader({ list, count, boardId, leading, drag, startEditing = false, onEditingFinished, compact = false }: {
  list: BoardList; count: number; boardId: string; leading?: ReactNode; drag?: HeaderDrag; startEditing?: boolean; onEditingFinished?: () => void; compact?: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirmAction = useConfirm();
  const [editing, setEditing] = useState(startEditing);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  useLayoutEffect(() => { if (startEditing) setEditing(true); }, [startEditing]);
  useLayoutEffect(() => {
    if (!editing) return;
    input.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, [editing]);
  function finishEditing(restoreFocus = false) {
    setEditing(false); setNameError(null); onEditingFinished?.();
    if (restoreFocus) requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  }
  const dragged = useRef(false);
  useEffect(() => {
    if (drag?.isDragging) { dragged.current = true; return; }
    if (!dragged.current) return;
    const timer = setTimeout(() => { dragged.current = false; }, 0);
    return () => clearTimeout(timer);
  }, [drag?.isDragging]);
  function startDrag(event: MouseEvent<HTMLElement> | TouchEvent<HTMLElement>) {
    if (editing || !drag || drag.disabled || (event.target instanceof Element && event.target.closest('[data-no-list-drag]'))) return;
    const listener = event.type === 'mousedown' ? drag.listeners?.onMouseDown : drag.listeners?.onTouchStart;
    listener?.(event);
  }
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  async function rename(name: string) {
    if (savingRef.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === list.name) { finishEditing(); return; }
    savingRef.current = true; setSaving(true); setNameError(null);
    try {
      const view = await api.patch<{ id: string; boardId: string; name: string; position: number }>(`/lists/${list.id}`, { name: trimmed });
      qc.setQueryData<Board>(['board', boardId], (board) => board ? upsertList(board, view) : board);
      finishEditing();
    } catch (error) { const message = errorMessage(error); setNameError(message); toast(message); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function archive() {
    menu.current?.hidePopover();
    if (!await confirmAction({ title: 'Archive list?', description: `“${list.name}” and its ${list.cards.length} cards will be archived.`, confirmLabel: 'Archive list' })) return;
    try { await api.del(`/lists/${list.id}`); await qc.invalidateQueries({ queryKey: ['board', boardId] }); }
    catch (error) { toast(errorMessage(error)); }
  }
  return <header data-testid="list-header" onMouseDown={startDrag} onTouchStart={startDrag}
    className={`flex shrink-0 items-center gap-2 ${compact ? 'h-12 px-2' : 'h-15 px-3 py-3'} ${drag && !drag.disabled && !editing ? 'cursor-grab select-none active:cursor-grabbing' : ''}`}>
    {leading}
    {editing ? <Input ref={input} data-no-list-drag disabled={saving} aria-busy={saving} aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${menuId}-name-error` : undefined} defaultValue={list.name} aria-label="List name" maxLength={120}
      onBlur={(event) => void rename(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); event.stopPropagation(); finishEditing(true); } }}
      className="min-w-0 flex-1 select-text px-2 py-1.5 text-sm font-semibold" />
      : <h2 className="min-w-0 flex-1"><button type="button" ref={(element) => { title.current = element; drag?.setActivatorNodeRef(element); }} {...(drag?.disabled ? {} : drag?.attributes)}
        onKeyDown={(event) => { if (!drag?.disabled) drag?.listeners?.onKeyDown?.(event); }}
        onClick={() => { if (!dragged.current) setEditing(true); }}
        title={drag && !drag.disabled ? `${list.name} · Drag to reorder, click to rename` : list.name}
        className={`tap min-h-9 w-full truncate rounded-md text-left text-sm font-semibold tracking-normal hover:bg-muted ${drag && !drag.disabled ? 'cursor-grab active:cursor-grabbing' : ''}`}>{list.name}</button></h2>}
    {nameError ? <span id={`${menuId}-name-error`} className="sr-only">{nameError}</span> : null}
    <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-1.5 text-caption font-medium text-secondary-foreground" aria-label={`${count} of ${list.cards.length} cards`}>
      {count === list.cards.length ? count : `${count}/${list.cards.length}`}
    </span>
    <button data-no-list-drag type="button" aria-label={`List actions for ${list.name}`} popoverTarget={menuId} onClick={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 128)), left: Math.max(8, Math.min(rect.right - 160, window.innerWidth - 168)) });
    }} className="tap inline-flex min-h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:bg-surface"><Icon name="more" /></button>
    <div data-no-list-drag ref={menu} id={menuId} popover="auto" role="group" aria-label={`Actions for ${list.name}`} style={position} className="fixed m-0 w-40 rounded-lg border border-border bg-surface p-1 text-sm text-foreground shadow-lg">
      <button type="button" className="ui-nav-link tap w-full" onClick={() => { menu.current?.hidePopover(); setEditing(true); }}>Rename</button>
      <button type="button" className="ui-nav-link tap w-full text-danger-text" onClick={() => void archive()}>Archive list</button>
    </div>
  </header>;
}
