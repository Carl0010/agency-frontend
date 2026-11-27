'use client';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useConfirm } from '@/components/confirmation';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cardPath } from '@/lib/cards';
import type { Checklist } from '@/lib/types';
import { formText } from '@/lib/form';

/** Checklists (AC17). Progress is computed from items here and on the tile — never stored. */
export function Checklists({ cardId, projectId, checklists }: { cardId: string; projectId: string; checklists: Checklist[] }) {
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

  const reorder = useReorder(
    [...checklists].sort((a, b) => a.position - b.position),
    (id, beforeChecklistId) => run(() => api.patch(`/checklists/${id}`, { beforeChecklistId })),
  );

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = formText(new FormData(e.currentTarget), 'title');
    if (!title) return;
    await run(() => api.post(cardPath(cardId, projectId, '/checklists'), { title }));
    setAdding(false);
  }

  return (
    <section aria-label="Checklists" className="space-y-4">
      <Sortable reorder={reorder}>
        {reorder.shown.map((c) => <ChecklistView key={c.id} checklist={c} run={run} />)}
      </Sortable>
      {adding ? (
        <form onSubmit={(e) => void create(e)} className="flex gap-2">
          <input name="title" autoFocus defaultValue="Checklist" aria-label="Checklist title" maxLength={200} className="ui-input tap flex-1" />
          <Button type="submit">Add</Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Icon name="plus" className="size-4" />Checklist
        </Button>
      )}
    </section>
  );
}

function ChecklistView({ checklist, run }: { checklist: Checklist; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const confirmAction = useConfirm();
  const sortable = useSortable({ id: checklist.id });
  const [editingTitle, setEditingTitle] = useState(false);
  const [newItem, setNewItem] = useState('');
  const reorder = useReorder(
    [...checklist.items].sort((a, b) => a.position - b.position),
    (id, beforeItemId) => run(() => api.patch(`/checklist-items/${id}`, { beforeItemId })),
  );
  const items = reorder.shown;
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
    <div data-testid="checklist" ref={sortable.setNodeRef} style={sortableStyle(sortable)} className={`group/checklist space-y-2 rounded-lg ${sortable.isDragging ? 'relative z-10 bg-surface shadow-lg' : ''}`}>
      <div className="flex items-center gap-1.5">
        <DragHandle sortable={sortable} label={`Reorder ${checklist.title}`} group="group-hover/checklist:opacity-100" />
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
          <h3 className="min-w-0 flex-1">
            <button type="button" onClick={() => setEditingTitle(true)} className="tap text-left text-label font-semibold hover:text-primary-text">
              {checklist.title}
            </button>
          </h3>
        )}
        <span data-testid="checklist-progress" className={`rounded-full px-2 py-0.5 text-caption font-medium tabular-nums ${pct === 100 ? 'bg-success-subtle text-success-text' : 'bg-subtle text-muted-foreground'}`}>
          {done}/{items.length}
        </span>
        <IconButton
          label={`Delete ${checklist.title}`}
          onClick={async () => { if (await confirmAction({ title: 'Delete checklist?', description: `“${checklist.title}” and all its items will be permanently deleted.`, confirmLabel: 'Delete checklist' })) await run(() => api.del(`/checklists/${checklist.id}`)); }}
        >
          <Icon name="trash" className="size-4" />
        </IconButton>
      </div>
      <div className="mx-1 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${checklist.title} progress`}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${pct === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <Sortable reorder={reorder}>
        <ul className="space-y-0.5">
          {items.map((item) => <ChecklistItemRow key={item.id} item={item} run={run} />)}
        </ul>
      </Sortable>
      <form onSubmit={(e) => void addItem(e)} className="flex gap-2 sm:pl-8">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add an item"
          aria-label={`Add an item to ${checklist.title}`}
          maxLength={1000}
          className="ui-input tap flex-1"
        />
        <Button type="submit" variant="secondary" disabled={!newItem.trim()}>Add</Button>
      </form>
    </div>
  );
}

function ChecklistItemRow({ item, run }: { item: Checklist['items'][number]; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id: item.id });
  return (
    <li data-testid="checklist-item" ref={sortable.setNodeRef} style={sortableStyle(sortable)} className={`group/item flex items-center gap-1 rounded-md pr-1 hover:bg-hover ${sortable.isDragging ? 'relative z-10 bg-surface shadow-lg ring-1 ring-border' : ''}`}>
      <DragHandle sortable={sortable} label={`Reorder ${item.text}`} group="group-hover/item:opacity-100" />
      <label className="tap inline-grid shrink-0 cursor-pointer place-items-center rounded-md px-1">
        <input
          type="checkbox"
          checked={item.doneAt !== null}
          aria-label={item.text}
          onChange={(e) => void run(() => api.patch(`/checklist-items/${item.id}`, { done: e.target.checked }))}
          className="h-4 w-4 accent-primary"
        />
      </label>
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
          className="ui-input min-h-8 flex-1 py-1"
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={`tap min-w-0 flex-1 py-1 text-left text-label ${item.doneAt ? 'text-muted-foreground line-through' : ''}`}>
          {item.text}
        </button>
      )}
      <span className="flex opacity-100 sm:opacity-0 sm:group-focus-within/item:opacity-100 sm:group-hover/item:opacity-100">
        <IconButton label={`Delete ${item.text}`} onClick={() => run(() => api.del(`/checklist-items/${item.id}`))}><Icon name="close" className="size-4" /></IconButton>
      </span>
    </li>
  );
}

type SortableState = ReturnType<typeof useSortable>;

/**
 * Drag-to-reorder for a list shown in server order. The new order shows at once and is saved by
 * placing the moved row before its new next neighbour (null: last), as the API's ordering expects.
 */
function useReorder<T extends { id: string }>(sorted: T[], persist: (id: string, beforeId: string | null) => Promise<void>) {
  const [order, setOrder] = useState<string[] | null>(null);
  const byId = new Map(sorted.map((row) => [row.id, row]));
  const shown = order
    ? [...order.filter((id) => byId.has(id)), ...sorted.map((row) => row.id).filter((id) => !order.includes(id))].map((id) => byId.get(id)!)
    : sorted;
  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = shown.map((row) => row.id);
    const to = ids.indexOf(String(over.id));
    const next = arrayMove(ids, ids.indexOf(String(active.id)), to);
    setOrder(next);
    try { await persist(String(active.id), next[to + 1] ?? null); } finally { setOrder(null); }
  }
  return { shown, onDragEnd };
}

/** A vertical drag-and-drop list: pointer drags from the handle; Space lifts, arrows move, Space drops, Esc cancels. */
function Sortable({ reorder, children }: { reorder: { shown: { id: string }[]; onDragEnd: (event: DragEndEvent) => Promise<void> }; children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void reorder.onDragEnd(event)}>
      <SortableContext items={reorder.shown.map((row) => row.id)} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

function sortableStyle(sortable: SortableState) {
  return { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition };
}

function DragHandle({ sortable, label, group }: { sortable: SortableState; label: string; group: string }) {
  return (
    <button
      type="button"
      ref={sortable.setActivatorNodeRef}
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label={label}
      title={`${label} · Drag, or Space to lift and arrows to move`}
      className={`tap inline-flex w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing sm:opacity-0 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${group}`}
    >
      <Icon name="grip" className="size-3.5" />
    </button>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => Promise<void>; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!onClick}
      onClick={() => void onClick?.()}
      className="tap inline-grid place-items-center rounded-md px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:invisible"
    >
      {children}
    </button>
  );
}
