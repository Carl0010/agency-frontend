'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { upsertList } from '@/lib/board-state';
import type { Board } from '@/lib/types';

export function AddList({ boardId, onCreated, layout = 'kanban' }: { boardId: string; onCreated: (id: string) => void; layout?: 'kanban' | 'list' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const list = await api.post<{ id: string; boardId: string; name: string; position: number }>(`/boards/${boardId}/lists`, { name: 'New list' });
      qc.setQueryData<Board>(['board', boardId], (board) => board ? upsertList(board, list) : board);
      onCreated(list.id);
    } catch (error) { toast(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <button type="button" onClick={() => void create()} disabled={busy} aria-busy={busy} data-testid="add-list-tile" className={`tap ${layout === 'kanban' ? 'hidden w-80 sm:flex' : 'flex w-full'} h-15 shrink-0 items-center gap-2 rounded-xl border border-dashed border-border-hover px-4 text-left text-sm font-medium text-secondary-foreground hover:border-border-hover hover:bg-subtle active:bg-muted disabled:pointer-events-none disabled:opacity-50`}>
    <Icon name="plus" />{busy ? 'Adding list…' : 'Add list'}
  </button>;
}
