'use client';

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Avatar, Button, Input, LABEL_BG, Select } from '@/components/ui';
import { EMPTY_FILTERS, isFiltering, type BoardFilters, type DueFilter } from '@/lib/filters';
import type { Label, Member } from '@/lib/types';

const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function FilterBar({ filters, onChange, members, labels, leading }: {
  filters: BoardFilters; onChange: (update: (current: BoardFilters) => BoardFilters) => void;
  members: Member[]; labels: Label[]; leading?: ReactNode;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ top: 0, left: 0 });
  const active = isFiltering(filters);
  const count = filters.assignees.length + filters.labels.length + (filters.due ? 1 : 0);
  const dismiss = () => { popover.current?.hidePopover(); trigger.current?.focus({ preventScroll: true }); };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = trigger.current; const panel = popover.current;
      if (!button || !panel) return;
      const anchor = button.getBoundingClientRect();
      const width = panel.getBoundingClientRect().width;
      const below = Math.max(0, window.innerHeight - anchor.bottom - 20);
      const above = Math.max(0, anchor.top - 20);
      const height = panel.scrollHeight + 2;
      const upwards = below < Math.min(height, 320) && above > below;
      const maxHeight = upwards ? above : below;
      setPosition({
        left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)),
        top: upwards ? Math.max(12, anchor.top - Math.min(height, maxHeight) - 8) : anchor.bottom + 8,
        maxHeight,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current);
    if (popover.current) observer.observe(popover.current);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [open, filters, members, labels]);
  useLayoutEffect(() => { if (open) close.current?.focus({ preventScroll: true }); }, [open]);

  return <div data-testid="board-toolbar" className="shrink-0 border-b border-border bg-surface px-4 py-2">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {leading}
      <div data-testid="board-filter-controls" className="ml-auto flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto sm:flex-1">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label="Search by card name" placeholder="Search by card name" value={filters.q} onChange={(event) => onChange((current) => ({ ...current, q: event.target.value }))} className="py-1.5 pl-9 text-label" />
        </div>
        <Button ref={trigger} variant="ghost" popoverTarget={id} aria-label="Filters" aria-expanded={open} aria-haspopup="dialog" className={`border border-border ${count ? 'bg-primary-muted text-primary-text' : ''}`}>
          <Icon name="settings" />Filters{count ? <span className="inline-flex min-w-5 items-center justify-center rounded bg-primary-subtle px-1 text-caption text-primary-text">{count}</span> : null}
        </Button>
        {active ? <Button variant="ghost" aria-label="Clear" className="px-2" onClick={() => onChange(() => EMPTY_FILTERS)}>Clear</Button> : null}
      </div>
    </div>
    <div ref={popover} id={id} popover="auto" role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`} data-testid="filter-panel"
      onToggle={(event) => setOpen(event.newState === 'open')}
      style={position} className="fixed inset-auto m-0 w-96 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="text-body font-semibold">Board filters</h2><p id={`${id}-hint`} className="mt-0.5 text-caption text-muted-foreground">{active ? 'Filters are on — clear them to drag cards in Kanban.' : 'Narrow your view. Filters apply as you select.'}</p></div>
        <Button ref={close} variant="ghost" size="icon" aria-label="Close filters" onClick={dismiss}><Icon name="close" /></Button>
      </header>
      <div className="space-y-4 p-4">
        <fieldset><legend className="mb-2 text-label font-semibold">Assignee</legend>
          <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain">
            {members.length ? members.map((member) => {
              const selected = filters.assignees.includes(member.userId);
              return <button key={member.userId} type="button" aria-pressed={selected} aria-label={`Assigned to ${member.name}`} onClick={() => onChange((current) => ({ ...current, assignees: toggle(current.assignees, member.userId) }))}
                className={`tap flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-label ${selected ? 'bg-primary-subtle text-primary-text' : 'text-secondary-foreground hover:bg-subtle'}`}>
                <Avatar person={{ id: member.userId, name: member.name, avatarUrl: member.avatarUrl }} size={24} /><span className="min-w-0 flex-1 break-words">{member.name}</span><SelectionMark selected={selected} />
              </button>;
            }) : <p className="py-2 text-label text-muted-foreground">No active members available.</p>}
          </div>
        </fieldset>
        <fieldset className="border-t border-border pt-3"><legend className="pr-2 text-label font-semibold">Labels</legend>
          <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain">
            {labels.length ? labels.map((label) => {
              const selected = filters.labels.includes(label.id);
              return <button key={label.id} type="button" aria-pressed={selected} onClick={() => onChange((current) => ({ ...current, labels: toggle(current.labels, label.id) }))}
                className={`tap flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-label ${selected ? 'bg-primary-subtle text-primary-text' : 'text-secondary-foreground hover:bg-subtle'}`}>
                <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${LABEL_BG[label.color] ?? 'bg-label-grey'}`} /><span className="min-w-0 flex-1 break-words">{label.name}</span><SelectionMark selected={selected} />
              </button>;
            }) : <p className="py-2 text-label text-muted-foreground">No labels in this workspace yet.</p>}
          </div>
        </fieldset>
        <label className="block space-y-2 border-t border-border pt-3"><span className="flex items-center gap-2 text-label font-semibold"><Icon name="clock" />Due date</span>
          <Select value={filters.due ?? ''} onChange={(event) => onChange((current) => ({ ...current, due: (event.target.value || null) as DueFilter | null }))} className="text-label">
            <option value="">Any time</option><option value="overdue">Overdue</option><option value="week">Due this week</option><option value="none">No due date</option>
          </Select>
        </label>
      </div>
      <footer className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-3">
        <Button variant="ghost" disabled={!count} onClick={() => onChange((current) => ({ ...current, assignees: [], labels: [], due: null }))}>Reset filters</Button><Button onClick={dismiss}>Done</Button>
      </footer>
    </div>
  </div>;
}

function SelectionMark({ selected }: { selected: boolean }) {
  return <span aria-hidden="true" className={`inline-flex size-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-surface'}`}>{selected ? <Icon name="check" className="size-3" /> : null}</span>;
}
