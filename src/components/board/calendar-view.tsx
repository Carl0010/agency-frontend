'use client';

import { closestCenter, DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { CardLink } from '@/components/card/card-link';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Button, LABEL_BG } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cardsByDay, localDateKey, monthGrid, monthParam, monthTitle, moveDueToDay, parseMonth, shiftMonth, type CalendarMonth } from '@/lib/calendar';
import { cardPath, cardRef } from '@/lib/cards';
import { dueState } from '@/lib/due';
import { isFiltering, matchesFilters, type BoardFilters } from '@/lib/filters';
import { applyTile } from '@/lib/realtime';
import type { Board, CardTile } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)));
const weekday = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** Arrows step a lifted card a day sideways or a week up and down. */
const dayCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[event.code];
  if (!step) return;
  event.preventDefault();
  const current = (context.over?.data.current?.date ?? context.active?.data.current?.date) as string | undefined;
  if (!current) return currentCoordinates;
  const target = new Date(Date.parse(`${current}T00:00:00Z`) + step * 86_400_000).toISOString().slice(0, 10);
  const entry = context.droppableContainers.getEnabled().find((container) => container.data.current?.date === target);
  const rect = entry && context.droppableRects.get(entry.id);
  if (!rect || !context.collisionRect) return currentCoordinates;
  return { x: currentCoordinates.x + rect.left + rect.width / 2 - (context.collisionRect.left + context.collisionRect.width / 2), y: currentCoordinates.y + rect.top + rect.height / 2 - (context.collisionRect.top + context.collisionRect.height / 2) };
};

type Lifted = { card: CardTile; date: string };

/** A month of the board's cards on their due days, in the viewer's profile timezone. */
export function CalendarView({ board, filters, now, timezone, cardHref }: { board: Board; filters: BoardFilters; now: Date; timezone: string; cardHref: (id: string) => string }) {
  const qc = useQueryClient(); const toast = useToast(); const ws = useWorkspace(); const { readOnly } = useWriteAvailability(ws);
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [active, setActive] = useState<Lifted | null>(null);
  const [pending, setPending] = useState(false);
  const rowPending = useIsMutating({ mutationKey: ['row-card'] }) > 0;
  const filtering = isFiltering(filters);
  const disabled = readOnly || pending || rowPending || filtering;

  const month = parseMonth(params.get('month'), now, timezone);
  const current = parseMonth(null, now, timezone);
  const today = localDateKey(now, timezone);
  const cards = board.lists.flatMap((list) => list.cards).filter((card) => !filtering || matchesFilters(card, filters, now));
  const days = cardsByDay(cards, timezone);
  const undated = cards.filter((card) => !card.dueAt).length;
  const weeks = monthGrid(month);
  const prefix = monthParam(month);
  const monthDays = [...days.keys()].filter((date) => date.startsWith(prefix)).sort();

  const goTo = (next: CalendarMonth) => {
    const query = new URLSearchParams(window.location.search);
    if (next.year === current.year && next.month === current.month) query.delete('month'); else query.set('month', monthParam(next));
    const qs = query.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: dayCoordinates, keyboardCodes: { start: ['Space'], end: ['Space'], cancel: ['Escape'] } }));

  async function move(source: Lifted, date: string) {
    const before = qc.getQueryData<Board>(['board', board.id])?.lists.flatMap((list) => list.cards).find((card) => card.id === source.card.id);
    if (!before?.dueAt) return;
    const dueAt = moveDueToDay(before.dueAt, date, timezone);
    setPending(true); applyTile(qc, { ...before, dueAt });
    try {
      applyTile(qc, await api.patch<CardTile>(cardPath(before.id, board.projectId), { dueAt }));
    } catch (error) {
      applyTile(qc, before);
      toast(`Couldn't move the card: ${errorMessage(error)}`);
    } finally {
      setPending(false); void qc.invalidateQueries({ queryKey: ['board', board.id] });
    }
  }

  return <div data-testid="calendar-view" className="flex min-h-0 flex-1 flex-col overflow-auto p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 data-testid="calendar-month" aria-live="polite" className="min-w-0 flex-1 text-body-lg font-semibold">{monthTitle(month)}</h2>
      <Button variant="secondary" size="sm" onClick={() => goTo(current)} disabled={month.year === current.year && month.month === current.month}>Today</Button>
      <div className="inline-flex gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => goTo(shiftMonth(month, -1))}><Icon name="chevron" className="size-4 rotate-180" /></Button>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => goTo(shiftMonth(month, 1))}><Icon name="chevron" className="size-4" /></Button>
      </div>
    </div>

    <DndContext sensors={sensors} collisionDetection={(args) => args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)} onDragStart={(event) => setActive(event.active.data.current as Lifted)} onDragCancel={() => setActive(null)} onDragEnd={(event) => {
      const source = active; setActive(null);
      const target = event.over?.data.current?.date as string | undefined;
      if (!source || !target || target === source.date || disabled) return;
      void move(source, target);
    }}>
      <div aria-label={`${monthTitle(month)} calendar`} role="group" className="hidden overflow-hidden rounded-lg border border-border bg-border sm:grid sm:gap-px" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {WEEKDAYS.map((date) => <div key={date.getUTCDay()} aria-hidden className="bg-subtle px-2 py-1.5 text-caption font-medium text-muted-foreground">{weekday(date)}</div>)}
        {weeks.flat().map((day) => <DayCell key={day.date} date={day.date} day={day.day} inMonth={day.inMonth} today={day.date === today} cards={days.get(day.date) ?? []} now={now} cardHref={cardHref} disabled={disabled} />)}
      </div>
      <DragOverlay dropAnimation={null}>{active ? <div className="w-48 rounded-md border border-primary-border bg-surface px-2 py-1 text-caption font-medium shadow-xl">{active.card.title}</div> : null}</DragOverlay>
    </DndContext>

    {/* Phones get the month as an agenda: seven columns do not fit a card title. */}
    <div data-testid="calendar-agenda" className="space-y-3 sm:hidden">
      {monthDays.length ? monthDays.map((date) => <section key={date} aria-label={dayLabel(date)} className="overflow-hidden rounded-lg border border-border bg-surface">
        <h3 className={`border-b border-border px-3 py-2 text-label font-semibold ${date === today ? 'text-primary-text' : ''}`}>{dayLabel(date)}{date === today ? <span className="ml-2 text-caption font-medium">Today</span> : null}</h3>
        <ul className="divide-y divide-border-subtle">{days.get(date)!.map((card) => <li key={card.id}><CardLink cardId={card.id} href={cardHref(card.id)} scroll={false} aria-label={`${cardRef(card)}: ${card.title}`} className="tap flex min-h-11 items-center gap-2 px-3 py-2 text-label hover:bg-hover"><ChipBody card={card} now={now} /></CardLink></li>)}</ul>
      </section>) : <p className="rounded-lg border border-dashed border-border-subtle px-4 py-8 text-center text-label text-muted-foreground">No cards due in {monthTitle(month)}</p>}
    </div>

    {undated ? <p data-testid="calendar-undated" className="mt-3 text-caption text-muted-foreground">{undated} {undated === 1 ? 'card has' : 'cards have'} no due date and {undated === 1 ? 'is' : 'are'} not shown.</p> : null}
    {filtering ? <p className="mt-1 text-caption text-muted-foreground">Clear filters to drag cards to another day.</p> : null}
  </div>;
}

function DayCell({ date, day, inMonth, today, cards, now, cardHref, disabled }: { date: string; day: number; inMonth: boolean; today: boolean; cards: CardTile[]; now: Date; cardHref: (id: string) => string; disabled: boolean }) {
  const drop = useDroppable({ id: `day:${date}`, data: { date }, disabled });
  return <div ref={drop.setNodeRef} role="group" aria-label={`${dayLabel(date)}${today ? ', today' : ''}, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`} data-date={date} data-testid="calendar-day" className={`flex min-h-28 min-w-0 flex-col gap-1 p-1.5 ${drop.isOver ? 'bg-primary-subtle' : inMonth ? 'bg-surface' : 'bg-board-canvas'}`}>
    <span aria-hidden className={`inline-flex size-6 shrink-0 items-center justify-center self-start rounded-full text-caption font-medium ${today ? 'bg-primary text-primary-foreground' : inMonth ? 'text-secondary-foreground' : 'text-muted-foreground'}`}>{day}</span>
    {cards.map((card) => <DayCard key={card.id} card={card} date={date} now={now} href={cardHref(card.id)} disabled={disabled} />)}
  </div>;
}

function DayCard({ card, date, now, href, disabled }: { card: CardTile; date: string; now: Date; href: string; disabled: boolean }) {
  const drag = useDraggable({ id: `calendar:${card.id}`, data: { card, date }, disabled });
  return <CardLink ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners} cardId={card.id} href={href} scroll={false} data-card-id={card.id} data-testid="calendar-card" aria-label={`${cardRef(card)}: ${card.title}`} aria-roledescription={disabled ? undefined : 'Draggable card. Space to lift, arrows to change day, Space to drop'}
    className={`flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 py-1 text-caption shadow-sm hover:border-input hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring ${disabled ? '' : 'cursor-grab'} ${drag.isDragging ? 'opacity-30' : ''}`}>
    <ChipBody card={card} now={now} />
  </CardLink>;
}

function ChipBody({ card, now }: { card: CardTile; now: Date }) {
  const state = dueState(card.dueAt, card.dueCompletedAt, now);
  const label = card.labels[0];
  return <>
    {state === 'done' ? <span className="inline-flex shrink-0 text-success-text"><Icon name="check" className="size-3" /><span className="sr-only">Done</span></span> : <span aria-hidden className={`h-3 w-1 shrink-0 rounded-full ${label ? LABEL_BG[label.color] ?? 'bg-label-grey' : 'bg-border'}`} />}
    <span className={`min-w-0 flex-1 truncate ${state === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{card.title}</span>
    {state === 'overdue' ? <span className="shrink-0 rounded-sm bg-danger-muted px-1 text-caption font-medium text-danger-text">Overdue</span> : null}
  </>;
}
