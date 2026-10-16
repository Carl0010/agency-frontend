'use client';

import { closestCenter, pointerWithin, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { FormError } from '@/components/auth-card';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Button, Field, Input } from '@/components/ui';
import { Dialog } from '@/components/ui-dialog';
import { api, errorMessage } from '@/lib/api';
import { assigneeChange, boardGroups, dueWindowOf, localDayAt, pickedDateEnd, previewAssignment, previewReschedule, type Assignable, type CardGroup, type Grouping, type RescheduleTarget } from '@/lib/board-grouping';
import { isFiltering, matchesFilters, type BoardFilters } from '@/lib/filters';
import { applyTile } from '@/lib/realtime';
import type { Board, CardTile, Member, Page } from '@/lib/types';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { useWorkspace } from '@/lib/workspace';
import { CardTileView } from './card-tile';
import { CardRowCells } from './list-view';

/** Keyboard traverses whole groups rather than sorting cards within a group. */
const groupCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.code) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.code) ? -1 : 0;
  if (!direction) return;
  event.preventDefault();
  const targets = context.droppableContainers.getEnabled().filter((entry) => entry.data.current?.type === 'group').sort((a, b) => {
    const first = a.node.current; const second = b.node.current;
    // Registration order can differ from display order when assignable people arrive.
    return first && second ? first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1 : 0;
  });
  const current: unknown = context.over?.data.current?.groupId ?? context.active?.data.current?.groupId;
  const index = targets.findIndex((entry) => entry.data.current?.groupId === current);
  const next = targets[index + direction];
  const rect = next && context.droppableRects.get(next.id);
  if (!rect || !context.collisionRect) return currentCoordinates;
  return { x: currentCoordinates.x + rect.left + rect.width / 2 - (context.collisionRect.left + context.collisionRect.width / 2), y: currentCoordinates.y + rect.top + rect.height / 2 - (context.collisionRect.top + context.collisionRect.height / 2) };
};
type Occurrence = { card: CardTile; groupId: string };

export function GroupedBoard({ board, grouping, view, filters, now, timezone, members, cardHref }: {
  board: Board; grouping: Exclude<Grouping, 'list'>; view: 'kanban' | 'list'; filters: BoardFilters; now: Date; timezone: string; members: Member[]; cardHref: (id: string) => string;
}) {
  const qc = useQueryClient(); const toast = useToast(); const ws = useWorkspace(); const { readOnly } = useWriteAvailability(ws);
  const people = useQuery({ queryKey: ['assignable', board.projectId], queryFn: ({ signal }) => api.get<Page<Assignable>>(`/projects/${board.projectId}/assignable`, signal), enabled: grouping === 'assignee' });
  const [active, setActive] = useState<Occurrence | null>(null);
  const [later, setLater] = useState<Occurrence | null>(null);
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const restore = useRef<{ cardId: string; groupId: string } | null>(null);
  const rowPending = useIsMutating({ mutationKey: ['row-card'] }) > 0;
  const disabled = readOnly || pending || rowPending || isFiltering(filters) || (grouping === 'assignee' && !people.data);
  const groups = boardGroups(board, grouping, people.data?.data ?? [], now, timezone).map((group) => ({ ...group, cards: group.cards.filter((card) => matchesFilters(card, filters, now)) }));
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: groupCoordinates, keyboardCodes: { start: ['Space'], end: ['Space'], cancel: ['Escape'] } }));
  useEffect(() => {
    if (pending || later || active || !restore.current) return;
    const { cardId, groupId } = restore.current; restore.current = null;
    const timer = setTimeout(() => {
      const candidates = [...document.querySelectorAll<HTMLButtonElement>('[data-group-card-handle]')].filter((node) => node.dataset.cardId === cardId);
      (candidates.find((node) => node.dataset.groupId === groupId) ?? candidates[0])?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [pending, later, active]);

  async function save(source: Occurrence, target: string, picked?: string): Promise<boolean> {
    const before = qc.getQueryData<Board>(['board', board.id])?.lists.flatMap((list) => list.cards).find((card) => card.id === source.card.id);
    if (!before) return false;
    const at = new Date();
    const preview = grouping === 'assignee' ? previewAssignment(before, source.groupId, target, people.data?.data ?? []) : previewReschedule(before, target as RescheduleTarget, at, timezone, picked);
    setPending(true); applyTile(qc, preview);
    restore.current = { cardId: before.id, groupId: target };
    try {
      const saved = grouping === 'assignee' ? await api.patch<CardTile>(`/cards/${before.id}/assignees`, assigneeChange(source.groupId, target)) : await api.post<CardTile>(`/cards/${before.id}/reschedule`, { to: target, ...(picked ? { dueAt: picked } : {}) });
      applyTile(qc, saved);
      setCollapsed((current) => { const next = new Set(current); next.delete(target); return next; });
      return true;
    } catch (error) {
      applyTile(qc, before); restore.current = { cardId: before.id, groupId: source.groupId };
      toast(`Couldn't update the card: ${errorMessage(error)}`); return false;
    } finally {
      setPending(false); void qc.invalidateQueries({ queryKey: ['board', board.id] });
    }
  }
  return <>
    {people.error && grouping === 'assignee' ? <div className="border-b border-border bg-surface px-4 py-2"><FormError message={errorMessage(people.error)} /><Button variant="secondary" onClick={() => void people.refetch()}>Retry assignable people</Button></div> : null}
    <DndContext sensors={sensors} collisionDetection={(args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)} onDragStart={(event) => setActive(event.active.data.current as Occurrence)} onDragCancel={() => { if (active) restore.current = { cardId: active.card.id, groupId: active.groupId }; setActive(null); }} onDragEnd={(event) => {
      const source = active; setActive(null);
      if (!source) return;
      restore.current = { cardId: source.card.id, groupId: source.groupId };
      const target = event.over?.data.current?.groupId as string | undefined;
      if (!target || source.groupId === target || disabled) return;
      if (grouping === 'due' && (target === 'overdue' || dueWindowOf(source.card, new Date(), timezone) === target)) return;
      if (grouping === 'due' && target === 'later') setLater(source); else void save(source, target);
    }}>
      <div data-testid="grouped-board" className={`@container min-h-0 flex-1 overflow-auto p-4 ${view === 'kanban' ? 'flex items-start gap-4' : ''}`}>
        {view === 'list' ? <table aria-label="Board cards" className="w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface text-left"><thead className="text-caption text-muted-foreground"><tr><th className="w-full px-3 py-2 @3xl:w-auto">Card</th>{['Assignees', 'Due date', 'Labels', 'Activity'].map((label) => <th key={label} className="hidden w-28 px-2 py-2 @3xl:table-cell">{label}</th>)}</tr></thead>{groups.map((group) => <Group key={group.id} group={group} view={view} disabled={disabled} open={!collapsed.has(group.id)} onToggle={() => setCollapsed((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>{group.cards.map((card) => <GroupCard key={card.id} card={card} groupId={group.id} groupName={group.name} board={board} view={view} now={now} members={members} href={cardHref(card.id)} disabled={disabled} />)}</Group>)}</table> : groups.map((group) => <Group key={group.id} group={group} view={view} disabled={disabled} open={!collapsed.has(group.id)} onToggle={() => setCollapsed((current) => { const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next; })}>{group.cards.map((card) => <GroupCard key={card.id} card={card} groupId={group.id} groupName={group.name} board={board} view={view} now={now} members={members} href={cardHref(card.id)} disabled={disabled} />)}</Group>)}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-72 rounded-lg border border-primary-border bg-surface p-3 text-label shadow-xl">{active.card.title}</div> : null}</DragOverlay>
    </DndContext>
    {later ? <LaterDate timezone={timezone} pending={pending} onClose={() => { restore.current = { cardId: later.card.id, groupId: later.groupId }; setLater(null); }} onSave={async (picked) => { if (await save(later, 'later', picked)) setLater(null); }} /> : null}
  </>;
}

function Group({ group, view, disabled, children, open, onToggle }: { group: CardGroup; view: 'kanban' | 'list'; disabled: boolean; children: React.ReactNode; open: boolean; onToggle: () => void }) {
  const drop = useDroppable({ id: `group:${group.id}`, data: { type: 'group', groupId: group.id }, disabled: disabled || !group.target });
  const heading = <><span className="min-w-0 flex-1 break-words">{group.name}</span><span className="text-caption text-muted-foreground">{group.cards.length}</span>{!group.target && group.id === 'overdue' ? <span className="sr-only">Not a drop target</span> : null}</>;
  if (view === 'list') return <tbody ref={drop.setNodeRef} aria-label={`Group ${group.name}`} data-group-id={group.id} className={drop.isOver ? 'bg-primary-subtle' : ''}><tr><th colSpan={5} scope="rowgroup" className="border-y border-border bg-subtle p-0"><button type="button" className="tap flex min-h-12 w-full items-center gap-3 px-3 text-left text-label font-semibold" aria-expanded={open} onClick={onToggle}><Icon name="chevron" className={`size-3 ${open ? 'rotate-90' : ''}`} />{heading}</button></th></tr>{open ? children : null}{open && !group.cards.length ? <tr><td colSpan={5} className="px-6 py-4 text-label text-muted-foreground">No cards</td></tr> : null}</tbody>;
  return <section ref={drop.setNodeRef} aria-label={`Group ${group.name}`} data-group-id={group.id} className={`flex max-h-full w-80 shrink-0 flex-col rounded-xl border ${drop.isOver ? 'border-primary-border bg-primary-subtle' : 'border-border bg-subtle'}`}><h2 className="flex min-h-12 items-center gap-3 border-b border-border px-4 py-3 text-label font-semibold">{heading}</h2><div className="min-h-0 space-y-3 overflow-y-auto p-3">{children}{!group.cards.length ? <p className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border-hover text-label text-muted-foreground">No cards</p> : null}</div></section>;
}

function GroupCard({ card, groupId, groupName, board, view, now, members, href, disabled }: { card: CardTile; groupId: string; groupName: string; board: Board; view: 'kanban' | 'list'; now: Date; members: Member[]; href: string; disabled: boolean }) {
  const drag = useDraggable({ id: `${groupId}:${card.id}`, data: { card, groupId }, disabled });
  const cardKey = `${board.project.key}-${card.number}`;
  const handle = <button type="button" ref={drag.setActivatorNodeRef} {...drag.attributes} {...drag.listeners} disabled={disabled} aria-label={`Move ${cardKey} from ${groupName}`} data-group-card-handle data-card-id={card.id} data-group-id={groupId} title="Space to lift, arrows to change group, Space to drop" className="tap inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"><Icon name="grip" className="size-3.5" /></button>;
  if (view === 'list') return <tr ref={drag.setNodeRef} data-testid="card-row" data-card-row-id={card.id} className={`group/list-row hover:bg-background ${drag.isDragging ? 'opacity-30' : ''}`}><CardRowCells card={card} cardKey={cardKey} now={now} href={href} selected={false} members={members} handle={handle} /></tr>;
  return <div ref={drag.setNodeRef} className={`relative ${drag.isDragging ? 'opacity-30' : ''}`}><div className="absolute right-1 top-1 z-10 rounded-md bg-surface">{handle}</div><Link href={href} scroll={false} data-card-id={card.id} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-ring [&_[data-testid=card-tile-title]]:pr-6" aria-label={`${cardKey}: ${card.title}`}><CardTileView card={card} projectKey={board.project.key} now={now} /></Link></div>;
}

function LaterDate({ timezone, pending, onClose, onSave }: { timezone: string; pending: boolean; onClose: () => void; onSave: (picked: string) => Promise<void> }) {
  const [date, setDate] = useState(''); const [error, setError] = useState<string | null>(null);
  return <Dialog title="Choose a later due date" onClose={() => { if (!pending) onClose(); }}><form className="space-y-4" onSubmit={(event) => {
    event.preventDefault(); const due = pickedDateEnd(date, timezone);
    if (due < localDayAt(new Date(), timezone, 8)) { setError('Choose a date after the next 7 days.'); return; }
    setError(null); void onSave(due.toISOString());
  }}><p className="text-label text-muted-foreground">Choose a date after the next 7 days, in {timezone}. Your card stays in place until you save.</p><Field label="Later due date"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} disabled={pending} /></Field><FormError message={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose} disabled={pending}>Cancel</Button><Button type="submit" disabled={pending}>Reschedule card</Button></div></form></Dialog>;
}
