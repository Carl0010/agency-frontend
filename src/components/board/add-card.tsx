'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { Button, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { upsertCard } from '@/lib/board-state';
import type { Board, CardTile } from '@/lib/types';

export function AddCard({ listId, boardId, compact = false }: { listId: string; boardId: string; compact?: boolean }) {
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
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
        className={`tap shrink-0 text-left text-label font-medium text-secondary-foreground hover:bg-primary-subtle active:bg-primary-muted ${compact ? 'min-h-8 rounded-md px-2 py-1' : 'min-h-12 rounded-xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-primary-border'}`}
      >
        <span className="inline-flex items-center gap-2"><Icon name="plus" />Add card</span>
      </button>
    );
  }
  return (
    <form onSubmit={(e) => void submit(e)} className={compact ? 'flex flex-wrap items-start gap-2 py-2' : 'shrink-0 space-y-3 rounded-xl border border-border bg-surface p-3 shadow-sm'}>
      {compact ? <Input autoFocus value={title} maxLength={500} aria-label="Card title" placeholder="Card title — Enter to add" onChange={(event) => setTitle(event.target.value)} onKeyDown={onKeyDown} className="min-w-40 flex-1 py-1 text-label" /> : <Textarea
        autoFocus
        rows={2}
        value={title}
        maxLength={500}
        aria-label="Card title"
        placeholder="Card title — Enter to add"
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-20 resize-none"
      />}
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
