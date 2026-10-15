'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useConfirm } from '@/components/confirmation';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Checklist } from '@/lib/types';
import { formText } from '@/lib/form';

/** Checklists (AC17). Progress is computed from items here and on the tile — never stored. */
export function Checklists({ cardId, checklists }: { cardId: string; checklists: Checklist[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      await qc.invalidateQueries({ queryKey: ['card', cardId] });
    }
  };

  const sorted = [...checklists].sort((a, b) => a.position - b.position);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = formText(new FormData(e.currentTarget), 'title');
    if (!title) return;
    await run(() => api.post(`/cards/${cardId}/checklists`, { title }));
    setAdding(false);
  }

  return (
    <section aria-label="Checklists" className="space-y-4">
      {sorted.map((c, i) => (
        <ChecklistView
          key={c.id}
          checklist={c}
          run={run}
          moveUp={i > 0 ? () => run(() => api.patch(`/checklists/${c.id}`, { beforeChecklistId: sorted[i - 1]?.id })) : undefined}
          moveDown={i < sorted.length - 1 ? () => run(() => api.patch(`/checklists/${c.id}`, { beforeChecklistId: sorted[i + 2]?.id ?? null })) : undefined}
        />
      ))}
      {adding ? (
        <form onSubmit={(e) => void create(e)} className="flex gap-2">
          <input name="title" autoFocus defaultValue="Checklist" aria-label="Checklist title" maxLength={200} className="tap flex-1 rounded-md border border-input px-2 text-sm" />
          <Button type="submit">Add</Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Checklist
        </Button>
      )}
    </section>
  );
}

function ChecklistView({
  checklist,
  run,
  moveUp,
  moveDown,
}: {
  checklist: Checklist;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  moveUp?: () => Promise<void>;
  moveDown?: () => Promise<void>;
}) {
  const confirmAction = useConfirm();
  const [editingTitle, setEditingTitle] = useState(false);
  const [newItem, setNewItem] = useState('');
  const items = [...checklist.items].sort((a, b) => a.position - b.position);
  const done = items.filter((i) => i.doneAt).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function addItem(e: FormEvent) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    setNewItem('');
    await run(() => api.post(`/checklists/${checklist.id}/items`, { text }));
  }

  return (
    <div data-testid="checklist" className="space-y-2">
      <div className="flex items-center gap-2">
        {editingTitle ? (
          <input
            autoFocus
            defaultValue={checklist.title}
            aria-label="Checklist title"
            maxLength={200}
            onBlur={(e) => {
              setEditingTitle(false);
              const title = e.target.value.trim();
              if (title && title !== checklist.title) void run(() => api.patch(`/checklists/${checklist.id}`, { title }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            className="flex-1 rounded border border-ring px-1 text-sm font-semibold"
          />
        ) : (
          <h3 className="flex-1">
            <button type="button" onClick={() => setEditingTitle(true)} className="tap text-left text-sm font-semibold hover:underline">
              {checklist.title}
            </button>
          </h3>
        )}
        <span data-testid="checklist-progress" className="text-xs text-muted-foreground">
          {done}/{items.length}
        </span>
        <IconButton label={`Move ${checklist.title} up`} onClick={moveUp}>↑</IconButton>
        <IconButton label={`Move ${checklist.title} down`} onClick={moveDown}>↓</IconButton>
        <IconButton
          label={`Delete ${checklist.title}`}
          onClick={async () => { if (await confirmAction({ title: 'Delete checklist?', description: `“${checklist.title}” and all its items will be permanently deleted.`, confirmLabel: 'Delete checklist' })) await run(() => api.del(`/checklists/${checklist.id}`)); }}
        >
          ✕
        </IconButton>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${checklist.title} progress`}>
        <div className={`h-full ${pct === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            run={run}
            moveUp={i > 0 ? () => run(() => api.patch(`/checklist-items/${item.id}`, { beforeItemId: items[i - 1]?.id })) : undefined}
            moveDown={i < items.length - 1 ? () => run(() => api.patch(`/checklist-items/${item.id}`, { beforeItemId: items[i + 2]?.id ?? null })) : undefined}
          />
        ))}
      </ul>
      <form onSubmit={(e) => void addItem(e)} className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add an item"
          aria-label={`Add an item to ${checklist.title}`}
          maxLength={1000}
          className="tap flex-1 rounded-md border border-input px-2 py-1 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={!newItem.trim()}>Add</Button>
      </form>
    </div>
  );
}

function ChecklistItemRow({
  item,
  run,
  moveUp,
  moveDown,
}: {
  item: Checklist['items'][number];
  run: (fn: () => Promise<unknown>) => Promise<void>;
  moveUp?: () => Promise<void>;
  moveDown?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li data-testid="checklist-item" className="group flex items-center gap-2">
      <input
        type="checkbox"
        checked={item.doneAt !== null}
        aria-label={item.text}
        onChange={(e) => void run(() => api.patch(`/checklist-items/${item.id}`, { done: e.target.checked }))}
        className="tap h-4 w-4 accent-primary"
      />
      {editing ? (
        <input
          autoFocus
          defaultValue={item.text}
          aria-label="Item text"
          maxLength={1000}
          onBlur={(e) => {
            setEditing(false);
            const text = e.target.value.trim();
            if (text && text !== item.text) void run(() => api.patch(`/checklist-items/${item.id}`, { text }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="flex-1 rounded border border-ring px-1 text-sm"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={`tap flex-1 text-left text-sm ${item.doneAt ? 'text-muted-foreground line-through' : ''}`}>
          {item.text}
        </button>
      )}
      <span className="flex opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton label={`Move ${item.text} up`} onClick={moveUp}>↑</IconButton>
        <IconButton label={`Move ${item.text} down`} onClick={moveDown}>↓</IconButton>
        <IconButton label={`Delete ${item.text}`} onClick={() => run(() => api.del(`/checklist-items/${item.id}`))}>✕</IconButton>
      </span>
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => Promise<void>; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={() => void onClick?.()}
      className="tap rounded px-1.5 text-xs text-muted-foreground hover:bg-subtle hover:text-foreground disabled:invisible"
    >
      {children}
    </button>
  );
}
