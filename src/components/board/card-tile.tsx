'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent } from 'react';
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
      className={`rounded-lg bg-white p-3 text-sm shadow-sm transition-shadow ${dragging ? 'rotate-1 shadow-xl ring-2 ring-blue-500' : 'hover:shadow-md'}`}
    >
      {card.labels.length ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.labels.map((l) => (
            <span key={l.id} title={l.name} className={`h-2 w-8 rounded-full ${LABEL_BG[l.color] ?? 'bg-slate-400'}`} />
          ))}
        </div>
      ) : null}
      <p className="line-clamp-2 break-words font-medium leading-snug text-slate-900">{card.title}</p>
      {hasMeta ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
          <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
          {card.hasDescription ? <span title="Has description" aria-label="Has description">≡</span> : null}
          {card.checklistTotal ? (
            <span
              data-testid="checklist-badge"
              className={card.checklistDone === card.checklistTotal ? 'font-medium text-green-700' : ''}
              title="Checklist items"
            >
              ☑ {card.checklistDone}/{card.checklistTotal}
            </span>
          ) : null}
          {card.commentCount ? <span data-testid="comment-count" title="Comments">💬 {card.commentCount}</span> : null}
          {card.attachmentCount ? <span title="Attachments">📎 {card.attachmentCount}</span> : null}
          <span className="ml-auto font-mono text-[11px] text-slate-400">
            {projectKey}-{card.number}
          </span>
          {card.assignees.length ? (
            <span className="flex -space-x-1.5">
              {shown.map((a) => (
                <Avatar key={a.id} person={a} size={22} />
              ))}
              {extra > 0 ? (
                <span className="inline-flex h-[22px] items-center rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold ring-2 ring-white">
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
      className={`tap shrink-0 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-blue-600 ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardTileView card={card} projectKey={projectKey} now={now} />
    </div>
  );
}
