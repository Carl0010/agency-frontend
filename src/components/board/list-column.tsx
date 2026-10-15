'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/icon';
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
  className?: string;
}

export function ListColumn({ list, cards, board, now, cardHref, dndDisabled, className = '' }: Props) {
  const sortable = useSortable({ id: `list:${list.id}`, data: { type: 'list' }, disabled: dndDisabled });
  const drop = useDroppable({ id: `cards:${list.id}`, data: { type: 'cards', listId: list.id } });

  return (
    <section
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-label={`List ${list.name}`}
      data-testid="list-column"
      data-list-id={list.id}
      className={`max-h-full min-h-64 w-full shrink-0 flex-col gap-3 sm:w-80 ${sortable.isDragging ? 'opacity-40' : ''} ${className}`}
    >
      <div data-testid="list-surface" className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-subtle pb-3">
        <ListHeader list={list} count={cards.length} boardId={board.id} leading={
          <button type="button" {...sortable.attributes} {...sortable.listeners} aria-label={`Move list ${list.name}`} disabled={dndDisabled}
            className="tap hidden min-h-9 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-secondary-foreground disabled:cursor-default disabled:opacity-40 sm:inline-flex">
            <Icon name="grip" className="size-3.5" />
          </button>
        } />
        <div ref={drop.setNodeRef} data-testid="list-cards" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 pb-1">
          {cards.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-caption text-muted-foreground">{list.cards.length ? 'No matching cards' : 'No cards yet'}</p> : null}
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c) => (
              <SortableCard key={c.id} card={c} projectKey={board.project.key} now={now} href={cardHref(c.id)} disabled={dndDisabled} />
            ))}
          </SortableContext>
        </div>
      </div>
      <AddCard listId={list.id} boardId={board.id} />
    </section>
  );
}
