'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';
import { Icon } from '@/components/icon';
import { DuePill } from '@/components/due-pill';
import { Avatar, LABEL_BG } from '@/components/ui';
import { matchesFilters, type BoardFilters } from '@/lib/filters';
import type { Board, BoardList, CardTile } from '@/lib/types';
import { AddCard } from './add-card';
import { AddList } from './add-list';
import { ListHeader } from './list-header';

/** A second presentation of the existing board query, preserving server order. */
export function BoardListView({ board, filters, now, cardHref, editingListId, onListCreated, onListEditFinished }: {
  board: Board; filters: BoardFilters; now: Date; cardHref: (id: string) => string;
  editingListId: string | null; onListCreated: (id: string) => void; onListEditFinished: (id: string) => void;
}) {
  const pathname = usePathname();
  return <div data-testid="board-list-view" className="@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
    <div className="space-y-6">
      {board.lists.map((list) => <ListGroup startEditing={editingListId === list.id} onEditingFinished={() => onListEditFinished(list.id)} key={list.id} list={list} cards={list.cards.filter((card) => matchesFilters(card, filters, now))} board={board} now={now} cardHref={cardHref} pathname={pathname} />)}
      <AddList boardId={board.id} onCreated={onListCreated} layout="list" />
    </div>
  </div>;
}

function ListGroup({ list, cards, board, now, cardHref, pathname, startEditing, onEditingFinished }: {
  startEditing: boolean; onEditingFinished: () => void;
  list: BoardList; cards: CardTile[]; board: Board; now: Date; cardHref: (id: string) => string; pathname: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  return <section aria-label={`List ${list.name}`} className="space-y-3" data-testid="list-group">
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="bg-subtle"><ListHeader startEditing={startEditing} onEditingFinished={onEditingFinished} list={list} count={cards.length} boardId={board.id} leading={
        <button type="button" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${list.name}`} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((value) => !value)} className="tap inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><Icon name="chevron" className={`size-3.5 ${expanded ? 'rotate-90' : ''}`} /></button>
      } /></div>
      <div id={contentId} hidden={!expanded}>
        {cards.length ? <table className="w-full table-fixed text-left" aria-label={`${list.name} cards`}>
          <thead className="border-y border-border-subtle text-caption font-medium text-muted-foreground"><tr>
            <th scope="col" className="px-4 py-2 font-medium">Card</th>
            <th scope="col" className="hidden w-28 px-3 py-2 font-medium @3xl:table-cell">Assignees</th>
            <th scope="col" className="hidden w-28 px-3 py-2 font-medium @3xl:table-cell">Due date</th>
            <th scope="col" className="hidden w-40 px-3 py-2 font-medium @3xl:table-cell">Labels</th>
            <th scope="col" className="hidden w-28 px-3 py-2 font-medium @3xl:table-cell">Activity</th>
          </tr></thead>
          <tbody className="divide-y divide-border-subtle">{cards.map((card) => {
            const selected = pathname.endsWith(`/c/${card.id}`);
            return <tr key={card.id} data-testid="card-row" className={selected ? 'bg-primary-subtle' : 'hover:bg-background'}>
              <td className="px-4 py-3 align-top">
                <Link href={cardHref(card.id)} scroll={false} data-card-id={card.id} data-tour="card" aria-label={`${board.project.key}-${card.number}: ${card.title}`} aria-expanded={selected} aria-controls={selected ? 'card-drawer' : undefined} className="tap block min-w-0 rounded-md py-1 hover:text-primary">
                  <span className="mb-0.5 block font-mono text-caption text-muted-foreground">{board.project.key}-{card.number}</span>
                  <span className="block break-words text-body-lg font-medium leading-6">{card.title}</span>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 @3xl:hidden">
                  <Assignees card={card} /><DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
                  {card.labels.length ? <Labels card={card} /> : null}
                  <Activity card={card} compact />
                </div>
              </td>
              <td className="hidden px-3 py-4 align-top @3xl:table-cell"><Assignees card={card} /></td>
              <td className="hidden px-3 py-4 align-top text-caption text-muted-foreground @3xl:table-cell">{card.dueAt ? <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} /> : 'No due date'}</td>
              <td className="hidden px-3 py-4 align-top @3xl:table-cell"><Labels card={card} /></td>
              <td className="hidden px-3 py-4 align-top @3xl:table-cell"><Activity card={card} /></td>
            </tr>;
          })}</tbody>
        </table> : <p className="px-4 py-7 text-center text-label text-muted-foreground">{list.cards.length ? 'No matching cards' : 'No cards yet'}</p>}
      </div>
    </div>
    <div hidden={!expanded} className="flex flex-col"><AddCard listId={list.id} boardId={board.id} /></div>
  </section>;
}

function Assignees({ card }: { card: CardTile }) {
  return card.assignees.length ? <span role="group" aria-label="Assignees" className="inline-flex items-center -space-x-1.5">
    {card.assignees.slice(0, 3).map((person) => <Avatar key={person.id} person={person} size={24} />)}
    {card.assignees.length > 3 ? <span className="inline-flex h-6 items-center rounded-full bg-muted px-1.5 text-caption font-medium text-secondary-foreground ring-2 ring-surface" title={card.assignees.slice(3).map((person) => person.name).join(', ')}>+{card.assignees.length - 3}</span> : null}
  </span> : <span className="text-caption text-muted-foreground">Unassigned</span>;
}
function Labels({ card }: { card: CardTile }) {
  return card.labels.length ? <span className="flex min-w-0 flex-wrap gap-1.5">{card.labels.map((label) => <span key={label.id} title={label.name} className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded bg-subtle px-2 py-0.5 text-caption text-secondary-foreground"><span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${LABEL_BG[label.color] ?? 'bg-label-grey'}`} /><span className="truncate">{label.name}</span></span>)}</span> : <span className="text-caption text-muted-foreground">No labels</span>;
}
function Activity({ card, compact = false }: { card: CardTile; compact?: boolean }) {
  const hasActivity = card.hasDescription || card.checklistTotal || card.commentCount || card.attachmentCount;
  if (!hasActivity) return compact ? null : <span className="text-caption text-muted-foreground">—<span className="sr-only">No activity</span></span>;
  return <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-muted-foreground">
    {card.hasDescription ? <span title="Has description" aria-label="Has description"><Icon name="description" className="size-3.5" /></span> : null}
    {card.checklistTotal ? <span aria-label={`${card.checklistDone} of ${card.checklistTotal} checklist items complete`} className={`inline-flex items-center gap-1 ${card.checklistDone === card.checklistTotal ? 'text-success-text' : ''}`}><Icon name="checklist" className="size-3.5" />{card.checklistDone}/{card.checklistTotal}</span> : null}
    {card.commentCount ? <span aria-label={`${card.commentCount} comment${card.commentCount === 1 ? '' : 's'}`} className="inline-flex items-center gap-1"><Icon name="comment" className="size-3.5" />{card.commentCount}</span> : null}
    {card.attachmentCount ? <span aria-label={`${card.attachmentCount} attachment${card.attachmentCount === 1 ? '' : 's'}`} className="inline-flex items-center gap-1"><Icon name="attachment" className="size-3.5" />{card.attachmentCount}</span> : null}
  </span>;
}
