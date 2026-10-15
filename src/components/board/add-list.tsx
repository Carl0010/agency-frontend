'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/icon';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { upsertList } from '@/lib/board-state';
import { formText } from '@/lib/form';
import type { Board } from '@/lib/types';

export function AddList({ boardId, layout = 'kanban' }: { boardId: string; layout?: 'kanban' | 'list' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const width = layout === 'kanban' ? 'hidden w-80 sm:flex' : 'flex w-full';
  const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = formText(new FormData(event.currentTarget), 'name');
    if (!name || busy) return;
    setBusy(true);
    try {
      const list = await api.post<{ id: string; boardId: string; name: string; position: number }>(`/boards/${boardId}/lists`, { name });
      qc.setQueryData<Board>(['board', boardId], (board) => board ? upsertList(board, list) : board);
      close();
    } catch (error) { toast(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return open ? <form onSubmit={(event) => void submit(event)} className={`${width} shrink-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4`}>
    <Input name="name" autoFocus required aria-label="List name" placeholder="List name" maxLength={120} onKeyDown={(event) => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); close(); } }} />
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy}>{busy ? 'Adding…' : 'Add list'}</Button><Button variant="ghost" size="sm" disabled={busy} onClick={close}>Cancel</Button></div>
  </form> : <button ref={trigger} type="button" onClick={() => setOpen(true)} data-testid="add-list-tile" className={`tap ${width} h-15 shrink-0 items-center gap-2 rounded-xl border border-dashed border-input px-4 text-left text-sm font-medium text-secondary-foreground hover:border-border-hover hover:bg-subtle active:bg-muted`}>
    <Icon name="plus" />Add list
  </button>;
}
