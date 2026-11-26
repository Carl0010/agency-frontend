'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { ArrivalChip } from '@/components/arrival';
import { ReplanAction } from '@/components/arrival-actions';
import { DuePill } from '@/components/due-pill';
import { Avatar, LABEL_BG } from '@/components/ui';
import { useShowArrivals } from '@/lib/board-display';
import { cardRef } from '@/lib/cards';
import type { CardTile as Tile } from '@/lib/types';

/** "Also in N projects": the other projects a card is in. Agency only; guests never get the count. */
export function AlsoInProjects({ card }: { card: Pick<Tile, 'placementCount'> }) {
  const others = (card.placementCount ?? 1) - 1;
  if (others < 1) return null;
  const label = `Also in ${others} other project${others === 1 ? '' : 's'}`;
  return <span data-testid="card-also-in" title={label} aria-label={label} className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-subtle px-1.5 py-0.5 text-caption font-medium text-secondary-foreground"><Icon name="board" className="size-3.5" />+{others}</span>;
}

/**
 * A card on the board: labels as colour bars, the title, then one quiet line that appears only when
 * there is something to say (due date, checklist, comments, files, other projects, people). The
 * reference (WEBS-1) and the arrival estimate live in the card's details; estimates show here only
 * when the board asks for them.
 */
export function CardTileView({ card, now, dragging, guest = false }: { card: Tile; now: Date; dragging?: boolean; guest?: boolean }) {
  // Guests receive estimates only when the project shares them, so the setting decides for them.
  const showArrivals = useShowArrivals() || guest;
  const shown = card.assignees.slice(0, 3);
  const extra = card.assignees.length - shown.length;
  const others = (card.placementCount ?? 1) - 1;
  const hasMeta = card.dueAt || card.checklistTotal || card.commentCount || card.attachmentCount || card.assignees.length || (!guest && others > 0);
  return (
    <div
      className={`rounded-lg border border-border bg-surface px-3 py-2.5 shadow-sm transition-shadow ${dragging ? 'rotate-1 shadow-xl ring-2 ring-ring' : 'hover:border-primary-border hover:shadow-md'}`}
    >
      {card.labels.length ? (
        <div className="mb-1.5 flex flex-wrap gap-1" role="list" aria-label="Labels">
          {card.labels.map((label) => (
            <span key={label.id} role="listitem" title={label.name} data-testid="card-tile-label" className={`h-1.5 w-8 rounded-full ${LABEL_BG[label.color] ?? 'bg-label-grey'}`}>
              <span className="sr-only">{label.name}</span>
            </span>
          ))}
        </div>
      ) : null}
      <p title={card.title} data-testid="card-tile-title" className="line-clamp-3 break-words text-body font-medium leading-5 text-foreground">{card.title}</p>
      {showArrivals ? <ArrivalChip boardId={card.boardId} cardId={card.id} guest={guest} /> : null}
      {hasMeta ? (
        <div className="mt-2 flex min-h-6 items-center gap-x-2.5 gap-y-1 text-caption text-muted-foreground">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
            {card.checklistTotal ? (
              <span
                data-testid="checklist-badge"
                className={`inline-flex items-center gap-1 ${card.checklistDone === card.checklistTotal ? 'font-medium text-success-text' : ''}`}
                title="Checklist items"
                aria-label={`${card.checklistDone} of ${card.checklistTotal} checklist items done`}
              >
                <Icon name="checklist" className="size-3.5" />{card.checklistDone}/{card.checklistTotal}
              </span>
            ) : null}
            {card.commentCount ? <span data-testid="comment-count" title="Comments" aria-label={`${card.commentCount} comments`} className="inline-flex items-center gap-1"><Icon name="comment" className="size-3.5" />{card.commentCount}</span> : null}
            {card.attachmentCount ? <span title="Attachments" aria-label={`${card.attachmentCount} attachments`} className="inline-flex items-center gap-1"><Icon name="attachment" className="size-3.5" />{card.attachmentCount}</span> : null}
            {!guest ? <AlsoInProjects card={card} /> : null}
          </span>
          {card.assignees.length ? (
            <span className="flex shrink-0 items-center -space-x-1.5" aria-label={`Assigned to ${card.assignees.map((person) => person.name).join(', ')}`}>
              {shown.map((person) => <Avatar key={person.id} person={person} size={22} />)}
              {extra > 0 ? <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-1.5 text-caption font-semibold text-secondary-foreground ring-2 ring-surface">+{extra}</span> : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A tile that can be dragged with mouse, touch (long-press) or keyboard (Space). Enter or click opens it. */
export function SortableCard({ card, now, href, disabled }: { card: Tile; now: Date; href: string; disabled?: boolean }) {
  const router = useRouter();
  const showArrivals = useShowArrivals();
  const selected = usePathname().endsWith(`/c/${card.id}`);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listId: card.listId },
    disabled,
  });
  // The click that ends a mouse drag must not also open the card.
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
    else if (dragged.current) setTimeout(() => (dragged.current = false), 0);
  }, [isDragging]);
  const open = () => {
    if (!dragged.current && !selected) router.push(href, { scroll: false });
  };
  // Fetch the card's route as soon as the tile is pointed at or focused, so the drawer opens at once.
  const prefetch = () => router.prefetch(href);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);
    if (!e.defaultPrevented && e.key === 'Enter') open();
  };
  return (
    <div>
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={open}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      role="button"
      // Filtering disables sorting, while opening the card remains available.
      aria-disabled={undefined}
      aria-label={`${cardRef(card)}: ${card.title}`}
      data-testid="card-tile"
      data-tour="card"
      data-card-id={card.id}
      aria-expanded={selected}
      aria-controls={selected ? 'card-drawer' : undefined}
      className={`tap shrink-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-ring ${isDragging ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-primary-border' : ''}`}
    >
      <CardTileView card={card} now={now} />
    </div>
    {showArrivals ? <ReplanAction boardId={card.boardId} projectId={card.projectId} cardId={card.id} title={card.title} /> : null}
    </div>
  );
}
