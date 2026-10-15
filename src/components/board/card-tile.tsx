'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { DuePill } from '@/components/due-pill';
import { Avatar, LABEL_BG } from '@/components/ui';
import type { CardTile as Tile } from '@/lib/types';

export function CardTileView({ card, projectKey, now, dragging }: { card: Tile; projectKey: string; now: Date; dragging?: boolean }) {
  const shown = card.assignees.slice(0, 3);
  const extra = card.assignees.length - shown.length;
  const hasFacts = card.dueAt || card.checklistTotal || card.commentCount || card.attachmentCount || card.hasDescription;
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow ${dragging ? 'rotate-1 shadow-xl ring-2 ring-ring' : 'hover:border-primary-border hover:shadow-md'}`}
    >
      {card.labels.length ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {card.labels.map((label) => (
            <span key={label.id} title={label.name} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded bg-subtle px-2 py-0.5 text-caption font-medium text-secondary-foreground">
              <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${LABEL_BG[label.color] ?? 'bg-label-grey'}`} />
              <span className="truncate">{label.name}</span>
            </span>
          ))}
        </div>
      ) : null}
      <p title={card.title} data-testid="card-tile-title" className="line-clamp-3 break-words text-body-lg font-medium leading-6 text-foreground">{card.title}</p>
      {hasFacts ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-muted-foreground">
          <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
          {card.hasDescription ? <span title="Has description" aria-label="Has description"><Icon name="description" className="size-3.5" /></span> : null}
          {card.checklistTotal ? (
            <span
              data-testid="checklist-badge"
              className={`inline-flex items-center gap-1.5 ${card.checklistDone === card.checklistTotal ? 'font-medium text-success-text' : ''}`}
              title="Checklist items"
            >
              <Icon name="checklist" className="size-3.5" /> {card.checklistDone}/{card.checklistTotal}
            </span>
          ) : null}
          {card.commentCount ? <span data-testid="comment-count" title="Comments" className="inline-flex items-center gap-1.5"><Icon name="comment" className="size-3.5" /> {card.commentCount}</span> : null}
          {card.attachmentCount ? <span title="Attachments" className="inline-flex items-center gap-1.5"><Icon name="attachment" className="size-3.5" /> {card.attachmentCount}</span> : null}
        </div>
      ) : null}
      <div className="mt-3 flex min-h-6 items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <span className="truncate font-mono text-caption text-muted-foreground" data-testid="card-tile-key">{projectKey}-{card.number}</span>
        {card.assignees.length ? (
          <span className="flex shrink-0 items-center -space-x-1.5">
            {shown.map((person) => <Avatar key={person.id} person={person} size={24} />)}
            {extra > 0 ? <span className="inline-flex h-6 items-center rounded-full bg-muted px-1.5 text-caption font-semibold text-secondary-foreground ring-2 ring-surface">+{extra}</span> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** A tile that can be dragged with mouse, touch (long-press) or keyboard (Space). Enter or click opens it. */
export function SortableCard({ card, projectKey, now, href, disabled }: { card: Tile; projectKey: string; now: Date; href: string; disabled?: boolean }) {
  const router = useRouter();
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
    if (!dragged.current) router.push(href, { scroll: false });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    listeners?.onKeyDown?.(e);
    if (!e.defaultPrevented && e.key === 'Enter') open();
  };
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={open}
      role="button"
      // Filtering disables sorting, while opening the card remains available.
      aria-disabled={undefined}
      aria-label={`${projectKey}-${card.number}: ${card.title}`}
      data-testid="card-tile"
      data-tour="card"
      data-card-id={card.id}
      aria-expanded={selected}
      aria-controls={selected ? 'card-drawer' : undefined}
      className={`tap shrink-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-ring ${isDragging ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-primary-border' : ''}`}
    >
      <CardTileView card={card} projectKey={projectKey} now={now} />
    </div>
  );
}
