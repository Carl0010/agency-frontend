'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Board, BoardList, CardTile } from '@/lib/types';
import { AddCard } from './add-card';
import { ListHeader } from './list-header';
import { SortableCard } from './card-tile';

interface Props {
  list: BoardList;
  /** Cards after filtering; equals `list.cards` when no filter is active. */
  cards: CardTile[];
  board: Board;
  now: Date;
  cardHref: (cardId: string) => string;
  dndDisabled: boolean;
  startEditing?: boolean;
  onEditingFinished?: () => void;
  className?: string;
}

export function ListColumn({ list, cards, board, now, cardHref, dndDisabled, startEditing, onEditingFinished, className = '' }: Props) {
  const sortable = useSortable({ id: `list:${list.id}`, data: { type: 'list' }, disabled: dndDisabled });
  const drop = useDroppable({ id: `cards:${list.id}`, data: { type: 'cards', listId: list.id } });

  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-label={`List ${list.name}`}
      data-testid="list-column"
      data-list-id={list.id}
      className={`flex max-h-full min-h-0 w-[85vw] max-w-80 shrink-0 snap-center flex-col gap-2 sm:w-80 sm:gap-3 ${sortable.isDragging ? 'opacity-40' : ''} ${className}`}
    >
      <div data-testid="list-surface" className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-lane pb-3">
        <ListHeader startEditing={startEditing} onEditingFinished={onEditingFinished} list={list} count={cards.length} boardId={board.id} drag={{
          attributes: sortable.attributes, listeners: sortable.listeners,
          setActivatorNodeRef: sortable.setActivatorNodeRef, isDragging: sortable.isDragging,
          disabled: dndDisabled,
        }} />
        <div ref={drop.setNodeRef} data-testid="list-cards" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2.5 pb-1 sm:px-3">
          {cards.length === 0 ? <p data-testid="list-empty-state" className="flex min-h-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-subtle px-3 py-5 text-center text-caption text-muted-foreground">{list.cards.length ? 'No matching cards' : 'No cards yet'}</p> : null}
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c) => (
              <SortableCard key={c.id} card={c} now={now} href={cardHref(c.id)} disabled={dndDisabled} />
            ))}
          </SortableContext>
        </div>
      </div>
      <AddCard listId={list.id} boardId={board.id} />
    </section>
  );
}
