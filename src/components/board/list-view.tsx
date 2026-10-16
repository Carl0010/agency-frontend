'use client';

import { closestCenter, closestCorners, DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type ClientRect, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useIsMutating } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/icon';
import { LABEL_BG } from '@/components/ui';
import { isFiltering, matchesFilters, type BoardFilters } from '@/lib/filters';
import type { Board, BoardList, CardTile, Member } from '@/lib/types';
import { AddCard } from './add-card';
import { AddList } from './add-list';
import { ListHeader } from './list-header';
import { RowAssignees, RowDue, RowName } from './list-row-editors';

const sectionRect = (rect: ClientRect): ClientRect => ({ left: rect.left, right: rect.right, width: rect.width, top: rect.top, bottom: rect.top + 48, height: 48 });
const listCollision: CollisionDetection = (args) => {
  const sections = args.active.data.current?.type === 'list';
  const droppableContainers = args.droppableContainers.filter((entry) => sections ? entry.data.current?.type === 'list' : entry.data.current?.type === 'card' || entry.data.current?.type === 'cards');
  return sections ? closestCenter({ ...args, droppableContainers, collisionRect: sectionRect(args.collisionRect), droppableRects: new Map([...args.droppableRects].map(([id, rect]) => [id, sectionRect(rect)])) }) : closestCorners({ ...args, droppableContainers });
};
const listKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const sections = args.context.active?.data.current?.type === 'list';
  const droppableRects = new Map([...args.context.droppableRects].filter(([id]) => {
    const type: unknown = args.context.droppableContainers.get(id)?.data.current?.type;
    return sections ? type === 'list' : type === 'card' || type === 'cards';
  }).map(([id, rect]) => [id, sections ? sectionRect(rect) : rect]));
  return sortableKeyboardCoordinates(event, { ...args, context: { ...args.context, droppableRects, collisionRect: sections && args.context.collisionRect ? sectionRect(args.context.collisionRect) : args.context.collisionRect } });
};

interface Props {
  board: Board; filters: BoardFilters; now: Date; cardHref: (id: string) => string; members: Member[];
  editingListId: string | null; onListCreated: (id: string) => void; onListEditFinished: (id: string) => void;
  activeDrag: { type: 'card' | 'list'; activeId: string } | null;
  onDragStart: (event: DragStartEvent) => void; onDragOver: (event: DragOverEvent) => void; onDragEnd: (event: DragEndEvent) => void; onDragCancel: () => void;
}

/** A single table: list rowgroups, section rows and editable card subrows. */
export function BoardListView({ board, filters, now, cardHref, editingListId, onListCreated, onListEditFinished, members, activeDrag, onDragStart, onDragOver, onDragEnd, onDragCancel }: Props) {
  const pathname = usePathname();
  const pending = useIsMutating({ mutationKey: ['row-card'] }) > 0;
  const disabled = isFiltering(filters) || pending;
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: listKeyboardCoordinates, keyboardCodes: { start: ['Space'], end: ['Space'], cancel: ['Escape'] } }));
  const activeName = activeDrag?.type === 'list' ? board.lists.find((list) => list.id === activeDrag.activeId)?.name : board.lists.flatMap((list) => list.cards).find((card) => card.id === activeDrag?.activeId)?.title;
  return <DndContext sensors={sensors} collisionDetection={listCollision} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
    <div data-testid="board-list-view" className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
      <table aria-label="Board cards" className="w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface text-left">
        <thead className="sticky top-0 z-10 bg-surface text-caption text-muted-foreground"><tr>
          <th scope="col" className="w-full border-b border-border px-3 py-2 font-medium @3xl:w-auto">Card</th>
          <th scope="col" className="hidden w-36 border-b border-border px-2 py-2 font-medium @3xl:table-cell">Assignees</th>
          <th scope="col" className="hidden w-32 border-b border-border px-2 py-2 font-medium @3xl:table-cell">Due date</th>
          <th scope="col" className="hidden w-36 border-b border-border px-2 py-2 font-medium @3xl:table-cell">Labels</th>
          <th scope="col" className="hidden w-28 border-b border-border px-2 py-2 font-medium @3xl:table-cell">Activity</th>
        </tr></thead>
        <SortableContext items={board.lists.map((list) => `list:${list.id}`)} strategy={verticalListSortingStrategy}>
          {board.lists.map((list) => <ListGroup key={list.id} list={list} cards={list.cards.filter((card) => matchesFilters(card, filters, now))} board={board} now={now} cardHref={cardHref} pathname={pathname} members={members} disabled={disabled} draggingListId={activeDrag?.type === 'list' ? activeDrag.activeId : null} startEditing={editingListId === list.id} onEditingFinished={() => onListEditFinished(list.id)} />)}
        </SortableContext>
      </table>
      <div className="mt-3"><AddList boardId={board.id} onCreated={onListCreated} layout="list" /></div>
    </div>
    <DragOverlay dropAnimation={null}>{activeDrag ? <div className="flex min-h-12 items-center gap-2 rounded-lg border border-primary-border bg-surface px-4 py-2 text-label font-medium shadow-xl"><Icon name="grip" /><span className="truncate">{activeName}</span></div> : null}</DragOverlay>
  </DndContext>;
}

function ListGroup({ list, cards, board, now, cardHref, pathname, members, disabled, draggingListId, startEditing, onEditingFinished }: {
  list: BoardList; cards: CardTile[]; board: Board; now: Date; cardHref: (id: string) => string; pathname: string; members: Member[];
  disabled: boolean; draggingListId: string | null; startEditing: boolean; onEditingFinished: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const open = expanded && draggingListId !== list.id;
  const sortable = useSortable({ id: `list:${list.id}`, data: { type: 'list' }, disabled });
  const end = useDroppable({ id: `cards:${list.id}`, data: { type: 'cards', listId: list.id }, disabled });
  return <tbody ref={sortable.setNodeRef} aria-label={`List ${list.name}`} data-testid="list-group" data-list-id={list.id} style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }} className={sortable.isDragging ? 'opacity-40' : ''}>
    <tr ref={!open ? end.setNodeRef : undefined} className="group/list-section bg-subtle"><th scope="rowgroup" colSpan={5} className="border-b border-border p-0">
      <ListHeader compact startEditing={startEditing} onEditingFinished={onEditingFinished} list={list} count={cards.length} boardId={board.id} leading={<>
        <DragHandle sortable={sortable} disabled={disabled} label={`Move list ${list.name}`} section />
        <button type="button" aria-label={`${open ? 'Collapse' : 'Expand'} ${list.name}`} aria-expanded={open} disabled={draggingListId === list.id} onClick={() => setExpanded((value) => !value)} className="tap inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><Icon name="chevron" className={`size-3 ${open ? 'rotate-90' : ''}`} /></button>
      </>} />
    </th></tr>
    <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
      {cards.map((card) => <CardRow key={card.id} card={card} projectKey={board.project.key} now={now} href={cardHref(card.id)} selected={pathname.endsWith(`/c/${card.id}`)} members={members} disabled={disabled || !open} hidden={!open} />)}
    </SortableContext>
    {!cards.length ? <tr hidden={!open}><td colSpan={5} className="px-12 py-3 text-label text-muted-foreground">{list.cards.length ? 'No matching cards' : 'No cards yet'}</td></tr> : null}
    <tr ref={open ? end.setNodeRef : undefined} data-testid="list-drop-end" hidden={!open}><td colSpan={5} className={`border-b border-border px-10 py-1 ${end.isOver ? 'bg-primary-subtle' : ''}`}><AddCard compact listId={list.id} boardId={board.id} /></td></tr>
  </tbody>;
}

function CardRow({ card, projectKey, now, href, selected, members, disabled, hidden }: { card: CardTile; projectKey: string; now: Date; href: string; selected: boolean; members: Member[]; disabled: boolean; hidden: boolean }) {
  const sortable = useSortable({ id: card.id, data: { type: 'card', listId: card.listId }, disabled });
  const cardKey = `${projectKey}-${card.number}`;
  return <tr ref={sortable.setNodeRef} hidden={hidden} data-testid="card-row" data-card-row-id={card.id} style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }} className={`group/list-row ${selected ? 'bg-primary-subtle' : 'hover:bg-background'} ${sortable.isDragging ? 'opacity-30' : ''}`}>
    <td className="border-b border-border-subtle px-2 py-1 align-middle">
      <div className="flex min-w-0 items-center gap-1">
        <DragHandle sortable={sortable} disabled={disabled} label={`Move card ${cardKey}`} />
        <Link href={href} scroll={false} data-card-id={card.id} data-tour="card" aria-label={`${cardKey}: ${card.title}`} aria-expanded={selected} aria-controls={selected ? 'card-drawer' : undefined} title="Open card details" className="tap inline-flex shrink-0 items-center rounded-md px-1 font-mono text-caption text-muted-foreground hover:bg-muted hover:text-primary">{cardKey}</Link>
        <RowName card={card} cardKey={cardKey} />
      </div>
      <div className="ml-9 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 @3xl:hidden">
        <RowAssignees card={card} cardKey={cardKey} members={members} /><RowDue card={card} cardKey={cardKey} now={now} />
        {card.labels.length ? <Labels card={card} /> : null}<Activity card={card} compact />
      </div>
    </td>
    <td className="hidden border-b border-border-subtle px-2 py-1 align-middle @3xl:table-cell"><RowAssignees card={card} cardKey={cardKey} members={members} /></td>
    <td className="hidden border-b border-border-subtle px-2 py-1 align-middle @3xl:table-cell"><RowDue card={card} cardKey={cardKey} now={now} /></td>
    <td className="hidden border-b border-border-subtle px-2 py-1 align-middle @3xl:table-cell"><Labels card={card} /></td>
    <td className="hidden border-b border-border-subtle px-2 py-1 align-middle @3xl:table-cell"><Activity card={card} /></td>
  </tr>;
}

function Labels({ card }: { card: CardTile }) {
  return card.labels.length ? <span className="flex min-w-0 flex-wrap gap-1">{card.labels.map((label) => <span key={label.id} title={label.name} className="inline-flex min-w-0 max-w-full items-center gap-1 rounded bg-subtle px-1.5 py-0.5 text-caption text-secondary-foreground"><span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${LABEL_BG[label.color] ?? 'bg-label-grey'}`} /><span className="truncate">{label.name}</span></span>)}</span> : <span className="text-caption text-muted-foreground">—<span className="sr-only">No labels</span></span>;
}

function Activity({ card, compact = false }: { card: CardTile; compact?: boolean }) {
  const hasActivity = card.hasDescription || card.checklistTotal || card.commentCount || card.attachmentCount;
  if (!hasActivity) return compact ? null : <span className="text-caption text-muted-foreground">—<span className="sr-only">No activity</span></span>;
  return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
    {card.hasDescription ? <span title="Has description" aria-label="Has description"><Icon name="description" className="size-3.5" /></span> : null}
    {card.checklistTotal ? <span aria-label={`${card.checklistDone} of ${card.checklistTotal} checklist items complete`} className={`inline-flex items-center gap-1 ${card.checklistDone === card.checklistTotal ? 'text-success-text' : ''}`}><Icon name="checklist" className="size-3.5" />{card.checklistDone}/{card.checklistTotal}</span> : null}
    {card.commentCount ? <span aria-label={`${card.commentCount} comment${card.commentCount === 1 ? '' : 's'}`} className="inline-flex items-center gap-1"><Icon name="comment" className="size-3.5" />{card.commentCount}</span> : null}
    {card.attachmentCount ? <span aria-label={`${card.attachmentCount} attachment${card.attachmentCount === 1 ? '' : 's'}`} className="inline-flex items-center gap-1"><Icon name="attachment" className="size-3.5" />{card.attachmentCount}</span> : null}
  </span>;
}

function DragHandle({ sortable, disabled, label, section = false }: { sortable: ReturnType<typeof useSortable>; disabled: boolean; label: string; section?: boolean }) {
  return <button type="button" ref={sortable.setActivatorNodeRef} {...sortable.attributes} {...sortable.listeners} disabled={disabled} aria-label={label} title={`${label} · Space to lift, arrows to move, Escape to cancel`} className={`tap inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-100 hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 sm:opacity-0 focus:opacity-100 [@media(hover:none)]:opacity-100 ${section ? 'group-hover/list-section:opacity-100 group-focus-within/list-section:opacity-100' : 'group-hover/list-row:opacity-100 group-focus-within/list-row:opacity-100'}`}><Icon name="grip" className="size-3.5" /></button>;
}
