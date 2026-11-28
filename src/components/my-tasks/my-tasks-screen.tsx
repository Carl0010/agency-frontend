'use client';

import { closestCorners, DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { MonthCalendar } from '@/components/board/calendar-view';
import { CardTileView, SortableCard } from '@/components/board/card-tile';
import { FilterBar } from '@/components/board/filter-bar';
import { CardLink } from '@/components/card/card-link';
import { useConfirm } from '@/components/confirmation';
import { DuePill } from '@/components/due-pill';
import { Icon } from '@/components/icon';
import { BoardSkeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { Button, Switch } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cardPath, cardRef } from '@/lib/cards';
import { PROJECT_DOT } from '@/lib/content-colors';
import { EMPTY_FILTERS, isFiltering, parseFilters, writeFilters, type BoardFilters } from '@/lib/filters';
import { beforeIdAt, groupBySection, moveCardLocal, moveSectionLocal, myTasksKey, previewToggle, sectionStep, shownCard, type SectionGroup } from '@/lib/my-tasks';
import { applyTile, useUserEvent } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import type { CardTile, Label, MyTaskCard, MyTasks, MyTaskSection, Page } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { SectionHeader, type SectionActions } from './section-header';

type View = 'kanban' | 'list' | 'calendar';
type Drag = { activeId: string; data: MyTasks; snapshot: MyTasks };

/** Due pills and overdue marks follow the clock: once a minute, and when a suspended tab returns. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}

const sectionOf = (id: string) => id.replace(/^section:/, '');

/**
 * `/w/[workspaceId]/my-tasks` (D-034): the person's private board of every card assigned to them.
 * New assignments arrive in Recently assigned; the person adds, renames, orders and deletes their own
 * sections and moves cards between them. Kanban, List and Calendar views share the board filters.
 * Nothing here is shared: no members, sharing, archive or icon.
 */
export function MyTasksScreen() {
  const ws = useWorkspace();
  const { user } = useSession();
  const timezone = user?.timezone ?? 'UTC';
  const qc = useQueryClient();
  const toast = useToast();
  const confirmAction = useConfirm();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { readOnly } = useWriteAvailability(ws);
  const key = myTasksKey(ws.id);
  const tasks = useQuery({ queryKey: key, queryFn: ({ signal }) => api.get<MyTasks>(`/workspaces/${ws.id}/my-tasks`, signal) });
  const labels = useQuery({ queryKey: ['labels', ws.id], queryFn: () => api.get<Page<Label>>(`/workspaces/${ws.id}/labels`) });
  // A new assignment arrives as a notification; the next read files it under Recently assigned.
  useUserEvent('notification.created', () => void qc.invalidateQueries({ queryKey: key }));
  const now = useMinuteClock();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  // The due date a card had before this page ticked it, so reopening an undated card leaves it undated.
  const dueBefore = useRef(new Map<string, string | null>());

  const filters = useMemo(() => parseFilters(new URLSearchParams(params.toString())), [params]);
  const setFilters = (update: (current: BoardFilters) => BoardFilters) => {
    const current = new URLSearchParams(window.location.search);
    const next = writeFilters(current, update(parseFilters(current))).toString();
    window.history.replaceState(null, '', `${pathname}${next ? `?${next}` : ''}${window.location.hash}`);
  };
  const filtering = isFiltering(filters);
  const viewParam = params.get('view');
  const view: View = viewParam === 'list' || viewParam === 'calendar' ? viewParam : 'kanban';
  const showCompleted = params.get('completed') === 'true';
  const pushQuery = (change: (query: URLSearchParams) => void) => {
    const next = new URLSearchParams(window.location.search); change(next);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setView = (next: View) => { setDrag(null); pushQuery((q) => { if (next === 'kanban') q.delete('view'); else q.set('view', next); if (next !== 'calendar') q.delete('month'); }); };
  const setShowCompleted = (on: boolean) => pushQuery((q) => { if (on) q.set('completed', 'true'); else q.delete('completed'); });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }),
  );

  if (tasks.isPending) return <BoardSkeleton view={view} />;
  if (tasks.error) return <main className="ui-page"><div role="alert" className="space-y-3 rounded-md border border-danger-border bg-danger-subtle p-4 text-label text-danger-text">
    <p>{errorMessage(tasks.error)}</p><Button variant="secondary" size="sm" onClick={() => void tasks.refetch()}>Try again</Button>
  </div></main>;

  const data = drag?.data ?? tasks.data;
  const shown = shownCard(filters, showCompleted, now);
  const groups = groupBySection(data, shown);
  // A section's count without filters, for "3/5" while filtering.
  const totals = new Map(groupBySection(data, shownCard(EMPTY_FILTERS, showCompleted, now)).map((g) => [g.section.id, g.cards.length]));
  const qs = params.toString();
  const cardHref = (card: { id: string; projectId: string }) => `/w/${ws.id}/my-tasks/p/${card.projectId}/c/${card.id}${qs ? `?${qs}` : ''}`;
  const hrefById = (id: string) => { const card = data.cards.find((c) => c.id === id); return card ? cardHref(card) : '#'; };
  const dndDisabled = filtering || readOnly;
  const put = (update: (current: MyTasks) => MyTasks) => qc.setQueryData<MyTasks>(key, (current) => current ? update(current) : current);
  const refresh = () => void qc.invalidateQueries({ queryKey: key });

  async function placeCard(cardId: string, sectionId: string, beforeId: string | null, snapshot: MyTasks) {
    put(() => moveCardLocal(snapshot, cardId, sectionId, beforeId));
    try {
      await api.put(`/workspaces/${ws.id}/my-tasks/cards/${cardId}`, { sectionId, beforeId });
    } catch (error) {
      put(() => snapshot);
      toast(`Couldn't move the card: ${errorMessage(error)} It's back where it was.`);
    } finally { refresh(); }
  }

  /** Where a dragged card is now, and where `overId` would put it: a card, or a section's end. */
  function resolve(state: MyTasks, activeId: string, overId: string): { sectionId: string; beforeId: string | null } | null {
    const visible = groupBySection(state, shown);
    if (overId.startsWith('section:')) return { sectionId: sectionOf(overId), beforeId: null };
    const group = visible.find((g) => g.cards.some((c) => c.id === overId));
    if (!group) return null;
    const ids = group.cards.map((c) => c.id);
    const from = ids.indexOf(activeId); const to = ids.indexOf(overId);
    const order = from >= 0 ? arrayMove(ids, from, to) : [...ids.slice(0, to), activeId, ...ids.slice(to)];
    return { sectionId: group.section.id, beforeId: order[order.indexOf(activeId) + 1] ?? null };
  }

  function onDragStart(event: DragStartEvent) {
    const current = qc.getQueryData<MyTasks>(key);
    if (current) setDrag({ activeId: String(event.active.id), data: current, snapshot: current });
  }
  function onDragOver(event: DragOverEvent) {
    if (!drag || !event.over) return;
    const card = drag.data.cards.find((c) => c.id === drag.activeId);
    const overId = String(event.over.id);
    const target = overId.startsWith('section:') ? sectionOf(overId) : drag.data.cards.find((c) => c.id === overId)?.sectionId;
    // Moving into another section opens a gap there at once; order within a section is the sortable's.
    if (!card || !target || target === card.sectionId) return;
    const visible = groupBySection(drag.data, shown).find((g) => g.section.id === target)?.cards ?? [];
    const index = overId.startsWith('section:') ? visible.length : visible.findIndex((c) => c.id === overId);
    setDrag({ ...drag, data: moveCardLocal(drag.data, drag.activeId, target, beforeIdAt(visible, drag.activeId, index)) });
  }
  function onDragEnd(event: DragEndEvent) {
    const d = drag; setDrag(null);
    if (!d || !event.over) return;
    const to = resolve(d.data, d.activeId, String(event.over.id));
    if (!to) return;
    const before = d.snapshot.cards.find((c) => c.id === d.activeId);
    if (!before) return;
    const originalNext = groupBySection(d.snapshot, () => true).find((g) => g.section.id === before.sectionId)?.cards.map((c) => c.id);
    const next = originalNext ? originalNext[originalNext.indexOf(before.id) + 1] ?? null : null;
    if (before.sectionId === to.sectionId && (to.beforeId === next || to.beforeId === before.id)) return;
    void placeCard(d.activeId, to.sectionId, to.beforeId, d.snapshot);
  }

  async function addSection() {
    try {
      const section = await api.post<MyTaskSection>(`/workspaces/${ws.id}/my-tasks/sections`, { name: 'New section' });
      put((current) => ({ ...current, sections: [...current.sections, section] }));
      setEditingSectionId(section.id);
    } catch (error) { toast(errorMessage(error)); }
  }
  const actions: SectionActions = {
    async rename(section, name) {
      try {
        const saved = await api.patch<MyTaskSection>(`/workspaces/${ws.id}/my-tasks/sections/${section.id}`, { name });
        put((current) => ({ ...current, sections: current.sections.map((s) => s.id === saved.id ? saved : s) }));
        return true;
      } catch (error) { toast(errorMessage(error)); return false; }
    },
    move(section, step) {
      const snapshot = qc.getQueryData<MyTasks>(key);
      const at = snapshot && sectionStep(snapshot.sections, section.id, step);
      if (!snapshot || !at) return;
      put(() => moveSectionLocal(snapshot, section.id, at.beforeId));
      void api.patch(`/workspaces/${ws.id}/my-tasks/sections/${section.id}`, { beforeId: at.beforeId })
        .catch((error: unknown) => { put(() => snapshot); toast(`Couldn't move the section: ${errorMessage(error)}`); })
        .finally(refresh);
    },
    remove(section) {
      void (async () => {
        const count = tasks.data?.cards.filter((c) => c.sectionId === section.id).length ?? 0;
        const recent = tasks.data?.sections.find((s) => s.kind === 'recent')?.name ?? 'Recently assigned';
        if (!await confirmAction({ title: 'Delete section?', description: count ? `“${section.name}” will be deleted. Its ${count} ${count === 1 ? 'card goes' : 'cards go'} back to ${recent}; the cards themselves stay in their projects.` : `“${section.name}” will be deleted.`, confirmLabel: 'Delete section' })) return;
        try { await api.del(`/workspaces/${ws.id}/my-tasks/sections/${section.id}`); }
        catch (error) { toast(errorMessage(error)); }
        finally { refresh(); }
      })();
    },
  };

  async function toggle(card: MyTaskCard, done: boolean) {
    const before = card;
    const restore = done ? undefined : dueBefore.current.get(card.id);
    if (done) dueBefore.current.set(card.id, card.dueAt);
    const replace = (next: MyTaskCard) => put((current) => ({ ...current, cards: current.cards.map((c) => c.id === next.id ? next : c) }));
    replace(previewToggle(card, done, new Date(), restore));
    setPending((set) => new Set(set).add(card.id));
    try {
      const saved = done
        ? await api.post<CardTile>(cardPath(card.id, card.projectId, '/reschedule'), { to: 'done' })
        : await api.patch<CardTile>(cardPath(card.id, card.projectId), { dueCompletedAt: null, ...(restore === null ? { dueAt: null } : {}) });
      replace({ ...before, ...saved, projectId: before.projectId, listId: before.listId, boardId: before.boardId });
      // Boards and an open card drawer show the tick too; this also refetches My tasks.
      applyTile(qc, saved);
      if (!done) dueBefore.current.delete(card.id);
      toast(done ? `Marked ${cardRef(card)} done.` : `Reopened ${cardRef(card)}.`, 'info');
    } catch (err) {
      replace(before);
      toast(errorMessage(err));
    } finally {
      setPending((set) => { const next = new Set(set); next.delete(card.id); return next; });
    }
  }

  async function moveDue(card: CardTile, dueAt: string) {
    const before = tasks.data?.cards.find((c) => c.id === card.id);
    if (!before) return;
    put((current) => ({ ...current, cards: current.cards.map((c) => c.id === card.id ? { ...c, dueAt } : c) }));
    try { applyTile(qc, await api.patch<CardTile>(cardPath(card.id, before.projectId), { dueAt })); }
    catch (error) { put((current) => ({ ...current, cards: current.cards.map((c) => c.id === card.id ? before : c) })); toast(`Couldn't move the card: ${errorMessage(error)}`); }
    finally { refresh(); }
  }

  const activeCard = drag ? data.cards.find((c) => c.id === drag.activeId) : undefined;
  const sectionCount = groups.length;
  const headerFor = (group: SectionGroup, index: number, layout: 'kanban' | 'list', leading?: ReactNode) => <SectionHeader section={group.section} shown={group.cards.length} total={totals.get(group.section.id) ?? group.cards.length}
    first={index === 0} last={index === sectionCount - 1} actions={actions} readOnly={readOnly} layout={layout} leading={leading}
    startEditing={editingSectionId === group.section.id} onEditingFinished={() => setEditingSectionId((current) => current === group.section.id ? null : current)} />;

  return (
    <div data-testid="my-tasks" className="flex h-full min-h-0 flex-col bg-board-canvas">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-chrome px-3 py-1.5 sm:px-4 sm:py-2">
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-primary-muted text-primary-text"><Icon name="check" className="size-4" /></span>
        <h1 className="min-w-0 truncate text-body-lg font-semibold leading-6 sm:text-lg">My tasks</h1>
        <span className="hidden items-center gap-1 text-caption text-muted-foreground sm:inline-flex"><Icon name="lock" className="size-3.5" />Only you see this board</span>
      </div>
      <FilterBar filters={filters} onChange={setFilters} members={[]} labels={labels.data?.data ?? []} assignees={false}
        dragHint="Filters are on — clear them to drag cards between sections."
        leading={<div role="group" aria-label="My tasks view" className="inline-flex shrink-0 gap-0.5 rounded-lg border border-border bg-background p-0.5">
          {([['kanban', 'board', 'Kanban'], ['list', 'list', 'List'], ['calendar', 'calendar', 'Calendar']] as const).map(([id, icon, label]) =>
            <button key={id} type="button" aria-pressed={view === id} aria-label={label} onClick={() => setView(id)} className={`ui-button tap min-h-8 gap-1.5 px-2.5 ${view === id ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:bg-hover'}`}><Icon name={icon} /><span className="hidden sm:inline">{label}</span></button>)}
        </div>}
        options={<Switch className="max-sm:min-h-11" checked={showCompleted} onChange={setShowCompleted} label="Show completed cards (last 7 days)" />}
      />

      {view === 'calendar' ? <MonthCalendar cards={data.cards.filter((c) => showCompleted || c.dueCompletedAt === null)} filters={filters} now={now} timezone={timezone} cardHref={hrefById} onMove={moveDue} /> : <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
        {view === 'kanban' ? <div data-testid="my-tasks-kanban" className={`flex min-h-0 flex-1 items-start gap-3 overflow-auto scroll-px-3 p-3 sm:snap-none sm:gap-4 sm:p-4 ${drag ? 'snap-none' : 'snap-x snap-mandatory'}`}>
          {groups.map((group, index) => <KanbanSection key={group.section.id} group={group} header={headerFor(group, index, 'kanban')} now={now} cardHref={cardHref} disabled={dndDisabled} filtering={filtering} />)}
          {readOnly ? null : <AddSection onAdd={addSection} layout="kanban" />}
        </div> : <div data-testid="my-tasks-list" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <div className="space-y-4">
            {groups.map((group, index) => <ListSection key={group.section.id} group={group} index={index} header={(leading) => headerFor(group, index, 'list', leading)} now={now} cardHref={cardHref} disabled={dndDisabled} filtering={filtering} readOnly={readOnly} pending={pending} onToggle={toggle} pathname={pathname} />)}
          </div>
          {readOnly ? null : <div className="mt-3"><AddSection onAdd={addSection} layout="list" /></div>}
        </div>}
        <DragOverlay dropAnimation={null}>{activeCard ? view === 'kanban'
          ? <div className="w-80"><CardTileView card={activeCard} now={now} dragging context={<ProjectLine card={activeCard} />} /></div>
          : <div className="flex min-h-12 items-center gap-2 rounded-lg border border-primary-border bg-surface px-4 py-2 text-label font-medium shadow-xl"><Icon name="grip" /><span className="truncate">{activeCard.title}</span></div> : null}</DragOverlay>
      </DndContext>}
    </div>
  );
}

function ProjectLine({ card }: { card: MyTaskCard }) {
  return <span className="mb-1 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
    <span aria-hidden="true" className={`size-2 shrink-0 rounded-sm ${PROJECT_DOT[card.projectColor] ?? 'bg-label-grey'}`} />
    <span className="truncate">{card.projectName}</span><span aria-hidden="true">·</span><span className="truncate">{card.listName}</span>
  </span>;
}

function KanbanSection({ group, header, now, cardHref, disabled, filtering }: { group: SectionGroup; header: ReactNode; now: Date; cardHref: (card: MyTaskCard) => string; disabled: boolean; filtering: boolean }) {
  const drop = useDroppable({ id: `section:${group.section.id}`, data: { type: 'section' }, disabled });
  return <section aria-label={`Section ${group.section.name}`} data-testid="my-tasks-section" data-section-id={group.section.id} className="flex max-h-full min-h-0 w-[85vw] max-w-80 shrink-0 snap-center flex-col sm:w-80">
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-lane pb-3">
      {header}
      <div ref={drop.setNodeRef} className={`flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-2.5 pb-1 sm:px-3 ${drop.isOver ? 'rounded-lg bg-primary-subtle' : ''}`}>
        {!group.cards.length ? <p className="flex min-h-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-subtle px-3 py-5 text-center text-caption text-muted-foreground">{filtering && group.total ? 'No matching cards' : 'Drag cards here'}</p> : null}
        <SortableContext items={group.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {group.cards.map((card) => <SortableCard key={card.id} card={card} now={now} href={cardHref(card)} disabled={disabled} sortData={{ type: 'card', sectionId: card.sectionId }} context={<ProjectLine card={card} />} />)}
        </SortableContext>
      </div>
    </div>
  </section>;
}

function ListSection({ group, index, header, now, cardHref, disabled, filtering, readOnly, pending, onToggle, pathname }: {
  group: SectionGroup; index: number; header: (leading: ReactNode) => ReactNode; now: Date; cardHref: (card: MyTaskCard) => string; disabled: boolean; filtering: boolean;
  readOnly: boolean; pending: ReadonlySet<string>; onToggle: (card: MyTaskCard, done: boolean) => void; pathname: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const drop = useDroppable({ id: `section:${group.section.id}`, data: { type: 'section' }, disabled });
  const id = `my-tasks-section-${index}`;
  return <section aria-label={`Section ${group.section.name}`} data-testid="my-tasks-section" data-section-id={group.section.id} className="overflow-hidden rounded-lg border border-border bg-surface">
    <div className="border-b border-border bg-subtle">{header(<button type="button" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.section.name}`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)} className="tap inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><Icon name="chevron" className={`size-3 ${expanded ? 'rotate-90' : ''}`} /></button>)}</div>
    {expanded ? <ul id={id} ref={drop.setNodeRef} className={`min-h-10 divide-y divide-border-subtle ${drop.isOver ? 'bg-primary-subtle' : ''}`}>
      <SortableContext items={group.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {group.cards.map((card) => <Row key={card.id} card={card} now={now} href={cardHref(card)} selected={pathname.endsWith(`/c/${card.id}`)} disabled={disabled} readOnly={readOnly} busy={pending.has(card.id)} onToggle={onToggle} />)}
      </SortableContext>
      {!group.cards.length ? <li className="px-12 py-3 text-label text-muted-foreground">{filtering && group.total ? 'No matching cards' : 'Drag cards here'}</li> : null}
    </ul> : null}
  </section>;
}

function Row({ card, now, href, selected, disabled, readOnly, busy, onToggle }: { card: MyTaskCard; now: Date; href: string; selected: boolean; disabled: boolean; readOnly: boolean; busy: boolean; onToggle: (card: MyTaskCard, done: boolean) => void }) {
  const sortable = useSortable({ id: card.id, data: { type: 'card', sectionId: card.sectionId }, disabled });
  const done = card.dueCompletedAt !== null;
  const key = cardRef(card);
  return <li ref={sortable.setNodeRef} data-testid="my-tasks-card" data-card-id={card.id} style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
    className={`group/row flex items-center gap-2 px-2 py-1.5 sm:gap-3 ${selected ? 'bg-primary-subtle' : 'hover:bg-background'} ${sortable.isDragging ? 'opacity-30' : ''}`}>
    <button type="button" ref={sortable.setActivatorNodeRef} {...sortable.attributes} {...sortable.listeners} disabled={disabled} aria-label={`Move card ${key}`} title={`Move card ${key} · Space to lift, arrows to move, Escape to cancel`}
      className="tap inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground opacity-100 hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30 focus:opacity-100 sm:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100"><Icon name="grip" className="size-3.5" /></button>
    <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? 'Reopen' : 'Mark done'}: ${card.title}`} title={readOnly ? 'This workspace is read-only' : done ? 'Reopen' : 'Mark done'}
      disabled={readOnly || busy} onClick={() => onToggle(card, !done)} className="tap group grid shrink-0 place-items-center rounded-full disabled:opacity-50">
      {/* `tap` sets a minimum height, so the round mark is its own fixed-size box inside the touch target. */}
      <span data-testid="my-tasks-tick" className={`grid size-6 place-items-center rounded-full border transition-colors ${done ? 'border-success-text bg-success-muted text-success-text' : 'border-input text-transparent group-hover:border-success-text group-hover:text-success-text'}`}><Icon name="check" className="size-3.5" /></span>
    </button>
    <div className="min-w-0 flex-1">
      <CardLink cardId={card.id} href={href} scroll={false} aria-expanded={selected} aria-controls={selected ? 'card-drawer' : undefined} className={`tap block truncate rounded-sm text-body hover:text-primary ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
        <span className="sr-only">{key}: </span>{card.title}
      </CardLink>
      <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
        <span className="font-mono">{key}</span><span aria-hidden="true">·</span>
        <span className="inline-flex min-w-0 items-center gap-1"><span aria-hidden="true" className={`size-2 shrink-0 rounded-sm ${PROJECT_DOT[card.projectColor] ?? 'bg-label-grey'}`} /><span className="truncate">{card.projectName}</span></span>
        <span aria-hidden="true">·</span><span className="truncate">{card.listName}</span>
      </span>
    </div>
    <span className="shrink-0"><DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} /></span>
  </li>;
}

function AddSection({ onAdd, layout }: { onAdd: () => Promise<void>; layout: 'kanban' | 'list' }) {
  const [busy, setBusy] = useState(false);
  return <button type="button" disabled={busy} aria-busy={busy} data-testid="add-section" onClick={() => { setBusy(true); void onAdd().finally(() => setBusy(false)); }}
    className={`tap ${layout === 'kanban' ? 'flex w-[85vw] max-w-80 snap-center sm:w-80' : 'flex w-full'} h-15 shrink-0 items-center gap-2 rounded-xl border border-dashed border-border-hover px-4 text-left text-sm font-medium text-secondary-foreground hover:bg-hover active:bg-muted disabled:pointer-events-none disabled:opacity-50`}>
    <Icon name="plus" />{busy ? 'Adding section…' : 'Add section'}
  </button>;
}
