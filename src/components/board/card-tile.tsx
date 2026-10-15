'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { DuePill } from '@/components/due-pill';
import { Avatar, LABEL_BG } from '@/components/ui';
import type { CardTile as Tile } from '@/lib/types';

export function CardTileView({ card, projectKey, now, dragging }: { card: Tile; projectKey: string; now: Date; dragging?: boolean }) {
  const shown = card.assignees.slice(0, 3);
  const extra = card.assignees.length - shown.length;
  const hasMeta =
    card.dueAt || card.assignees.length || card.checklistTotal || card.commentCount || card.attachmentCount || card.hasDescription;
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-3 text-body shadow-sm transition-shadow ${dragging ? 'rotate-1 shadow-xl ring-2 ring-ring' : 'hover:border-primary-border hover:shadow-md'}`}
    >
      {card.labels.length ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span key={l.id} title={l.name} className={`h-2 w-8 rounded-full ${LABEL_BG[l.color] ?? 'bg-disabled-foreground'}`} />
          ))}
        </div>
      ) : null}
      <p className="line-clamp-2 break-words font-medium leading-snug text-foreground">{card.title}</p>
      {hasMeta ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
          <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
          {card.hasDescription ? <span title="Has description" aria-label="Has description"><Icon name="description" className="size-3.5" /></span> : null}
          {card.checklistTotal ? (
            <span
              data-testid="checklist-badge"
              className={`inline-flex items-center gap-1 ${card.checklistDone === card.checklistTotal ? 'font-medium text-success-text' : ''}`}
              title="Checklist items"
            >
              <Icon name="checklist" className="size-3.5" /> {card.checklistDone}/{card.checklistTotal}
            </span>
          ) : null}
          {card.commentCount ? <span data-testid="comment-count" title="Comments" className="inline-flex items-center gap-1"><Icon name="comment" className="size-3.5" /> {card.commentCount}</span> : null}
          {card.attachmentCount ? <span title="Attachments" className="inline-flex items-center gap-1"><Icon name="attachment" className="size-3.5" /> {card.attachmentCount}</span> : null}
          <span className="ml-auto font-mono text-caption text-muted-foreground">
            {projectKey}-{card.number}
          </span>
          {card.assignees.length ? (
            <span className="flex -space-x-1.5">
              {shown.map((a) => (
                <Avatar key={a.id} person={a} size={22} />
              ))}
              {extra > 0 ? (
                <span className="inline-flex h-[22px] items-center rounded-full bg-muted px-1.5 text-caption font-semibold ring-2 ring-surface">
                  +{extra}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A tile that can be dragged with mouse, touch (long-press) or keyboard (Space). Enter or click opens it. */
export function SortableCard({ card, projectKey, now, href, disabled }: { card: Tile; projectKey: string; now: Date; href: string; disabled?: boolean }) {
  const router = useRouter();
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
      aria-label={`${projectKey}-${card.number}: ${card.title}`}
      data-testid="card-tile"
      data-tour="card"
      data-card-id={card.id}
      className={`tap shrink-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-ring ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardTileView card={card} projectKey={projectKey} now={now} />
    </div>
  );
}
