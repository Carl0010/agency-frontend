'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { DuePill } from '@/components/due-pill';
import { Icon } from '@/components/icon';
import { LoadingSkeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { PROJECT_DOT } from '@/lib/content-colors';
import { nextWindowBoundary } from '@/lib/board-grouping';
import { cardPath, cardRef } from '@/lib/cards';
import { groupMyWork, myWorkKey, previewToggle, type MyWorkGroup } from '@/lib/my-work';
import { applyTile, useUserEvent } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import type { CardTile, MyWorkCard, Page } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Regroup at the next due boundary or local midnight, and when a suspended tab comes back. */
function useMyWorkClock(cards: readonly MyWorkCard[], timezone: string): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date(); setNow(current);
      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(1, nextWindowBoundary(cards, current, timezone) - current.getTime()));
    };
    timer = setTimeout(tick, 0);
    document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, [cards, timezone]);
  return now;
}

/**
 * `/w/[workspaceId]/my-work` (D-033): the cards assigned to the viewer in every project they can see,
 * by due date, with a tick to complete and a click to open the card beside the list.
 */
export function MyWorkScreen() {
  const ws = useWorkspace();
  const { user } = useSession();
  const timezone = user?.timezone ?? 'UTC';
  const qc = useQueryClient();
  const toast = useToast();
  const { readOnly } = useWriteAvailability(ws);
  const key = myWorkKey(ws.id);
  const work = useQuery({ queryKey: key, queryFn: ({ signal }) => api.get<Page<MyWorkCard>>(`/workspaces/${ws.id}/my-work`, signal) });
  // A new assignment arrives as a notification.
  useUserEvent('notification.created', () => void qc.invalidateQueries({ queryKey: key }));
  const cards = work.data?.data ?? [];
  const now = useMyWorkClock(cards, timezone);
  const [showDone, setShowDone] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  // The due date a card had before this page ticked it, so reopening an undated card leaves it undated.
  const dueBefore = useRef(new Map<string, string | null>());

  async function toggle(card: MyWorkCard, done: boolean) {
    const before = card;
    const restore = done ? undefined : dueBefore.current.get(card.id);
    if (done) dueBefore.current.set(card.id, card.dueAt);
    const put = (next: MyWorkCard) => qc.setQueryData<Page<MyWorkCard>>(key, (page) => page ? { ...page, data: page.data.map((c) => c.id === next.id ? next : c) } : page);
    put(previewToggle(card, done, new Date(), restore));
    setPending((set) => new Set(set).add(card.id));
    try {
      const saved = done
        ? await api.post<CardTile>(cardPath(card.id, card.projectId, '/reschedule'), { to: 'done' })
        : await api.patch<CardTile>(cardPath(card.id, card.projectId), { dueCompletedAt: null, ...(restore === null ? { dueAt: null } : {}) });
      put({ ...before, ...saved, projectId: before.projectId, listId: before.listId, boardId: before.boardId });
      // Boards and an open card drawer show the tick too; this also refetches My work.
      applyTile(qc, saved);
      if (!done) dueBefore.current.delete(card.id);
      toast(done ? `Marked ${cardRef(card)} done.` : `Reopened ${cardRef(card)}.`, 'info');
    } catch (err) {
      put(before);
      toast(errorMessage(err));
    } finally {
      setPending((set) => { const next = new Set(set); next.delete(card.id); return next; });
    }
  }

  const groups = groupMyWork(cards, now, timezone);
  const open = groups.filter((group) => group.id !== 'done');
  const done = groups.find((group) => group.id === 'done');
  const openCount = open.reduce((sum, group) => sum + group.cards.length, 0);

  return (
    <main className="ui-page">
      <PageHeader title="My work" description="Cards assigned to you in every project you can see." />
      {work.isPending ? <LoadingSkeleton label="Loading your work" variant="rows" /> : work.error ? (
        <div role="alert" className="space-y-3 rounded-md border border-danger-border bg-danger-subtle p-4 text-label text-danger-text">
          <p>{errorMessage(work.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => void work.refetch()}>Try again</Button>
        </div>
      ) : !cards.length ? (
        <EmptyState icon="check" title="Nothing assigned to you" description="Cards assigned to you in any project show up here, soonest due first." />
      ) : <div className="space-y-6">
        {!openCount ? <p className="rounded-md border border-dashed border-input p-4 text-center text-label text-muted-foreground">All caught up. Nothing open is assigned to you.</p> : null}
        {open.map((group) => <Section key={group.id} group={group} now={now} readOnly={readOnly} pending={pending} onToggle={toggle} />)}
        {done ? <Section group={done} now={now} readOnly={readOnly} pending={pending} onToggle={toggle} collapsible expanded={showDone} onExpand={() => setShowDone((value) => !value)} /> : null}
      </div>}
    </main>
  );
}

const TONE: Partial<Record<MyWorkGroup['id'], string>> = { overdue: 'text-danger-text', today: 'text-warning-text' };

function Section({ group, now, readOnly, pending, onToggle, collapsible = false, expanded = true, onExpand }: {
  group: MyWorkGroup; now: Date; readOnly: boolean; pending: ReadonlySet<string>; onToggle: (card: MyWorkCard, done: boolean) => void;
  collapsible?: boolean; expanded?: boolean; onExpand?: () => void;
}) {
  const id = `my-work-${group.id}`;
  const heading = <>
    <span className={TONE[group.id] ?? ''}>{group.name}</span>
    <span className="ml-2 font-normal text-muted-foreground">{group.cards.length}</span>
  </>;
  return (
    <section aria-labelledby={`${id}-heading`} data-testid="my-work-section" data-window={group.id}>
      <h2 id={`${id}-heading`} className="mb-2 px-1 text-label font-semibold">
        {collapsible ? <button type="button" aria-expanded={expanded} aria-controls={id} onClick={onExpand} className="tap -ml-1 inline-flex items-center gap-1 rounded-md px-1 hover:bg-muted">
          <Icon name="chevron" className={`size-3 text-muted-foreground ${expanded ? 'rotate-90' : ''}`} />{heading}
        </button> : heading}
      </h2>
      {expanded ? <ul id={id} className="divide-y divide-border-subtle overflow-hidden rounded-md border border-border bg-surface">
        {group.cards.map((card) => <Row key={card.id} card={card} now={now} readOnly={readOnly} busy={pending.has(card.id)} onToggle={onToggle} />)}
      </ul> : null}
    </section>
  );
}

function Row({ card, now, readOnly, busy, onToggle }: { card: MyWorkCard; now: Date; readOnly: boolean; busy: boolean; onToggle: (card: MyWorkCard, done: boolean) => void }) {
  const ws = useWorkspace();
  const pathname = usePathname();
  const done = card.dueCompletedAt !== null;
  const key = cardRef(card);
  const href = `/w/${ws.id}/my-work/p/${card.projectId}/c/${card.id}`;
  const selected = pathname.endsWith(`/c/${card.id}`);
  return (
    <li data-testid="my-work-card" data-card-id={card.id} className={`flex items-center gap-3 px-3 py-2 ${selected ? 'bg-primary-subtle' : 'hover:bg-background'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Reopen' : 'Mark done'}: ${card.title}`}
        title={readOnly ? 'This workspace is read-only' : done ? 'Reopen' : 'Mark done'}
        disabled={readOnly || busy}
        onClick={() => onToggle(card, !done)}
        className="tap group grid shrink-0 place-items-center rounded-full disabled:opacity-50"
      >
        {/* `tap` sets a minimum height, so the round mark is its own fixed-size box inside the touch target. */}
        <span data-testid="my-work-tick" className={`grid size-6 place-items-center rounded-full border transition-colors ${done ? 'border-success-text bg-success-muted text-success-text' : 'border-input text-transparent group-hover:border-success-text group-hover:text-success-text'}`}>
          <Icon name="check" className="size-3.5" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <Link href={href} scroll={false} aria-expanded={selected} aria-controls={selected ? 'card-drawer' : undefined} className={`tap block truncate rounded-sm text-body hover:text-primary ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          <span className="sr-only">{key}: </span>{card.title}
        </Link>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
          <span className="font-mono">{key}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex min-w-0 items-center gap-1"><span aria-hidden="true" className={`size-2 shrink-0 rounded-sm ${PROJECT_DOT[card.projectColor] ?? 'bg-label-grey'}`} /><span className="truncate">{card.projectName}</span></span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{card.listName}</span>
        </span>
      </div>
      <span className="shrink-0"><DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} /></span>
    </li>
  );
}
