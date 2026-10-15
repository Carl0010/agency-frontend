'use client';

import { useState } from 'react';
import { Icon } from '@/components/icon';
import { Avatar, Input, LABEL_BG } from '@/components/ui';
import { EMPTY_FILTERS, isFiltering, type BoardFilters, type DueFilter } from '@/lib/filters';
import type { Label, Member } from '@/lib/types';

const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function FilterBar({
  filters,
  onChange,
  members,
  labels,
}: {
  filters: BoardFilters;
  onChange: (f: BoardFilters) => void;
  members: Member[];
  labels: Label[];
}) {
  const [open, setOpen] = useState(isFiltering(filters));
  const active = isFiltering(filters);
  return (
    <div className="shrink-0 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Filter cards"
            placeholder="Filter cards…"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            className="py-1.5 pl-9 text-label"
          />
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`ui-button tap border border-border ${active ? 'bg-primary-muted text-primary-text' : 'text-secondary-foreground hover:bg-subtle'}`}
        >
          <Icon name="settings" />Filters{active ? <span className="size-1.5 rounded-full bg-primary" aria-label="Active filters" /> : null}
        </button>
        {active ? (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="ui-button tap px-2 text-muted-foreground hover:bg-subtle hover:text-foreground">
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-background p-3" data-testid="filter-panel">
          <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
            <legend className="sr-only">Assignee</legend>
            <span className="mr-1 text-xs font-medium text-muted-foreground">Assignee</span>
            {members.map((m) => {
              const on = filters.assignees.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Assigned to ${m.name}`}
                  onClick={() => onChange({ ...filters, assignees: toggle(filters.assignees, m.userId) })}
                  className={`tap flex items-center justify-center rounded-full p-0.5 ${on ? 'ring-2 ring-ring' : 'opacity-70 hover:opacity-100'}`}
                >
                  <Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={26} />
                </button>
              );
            })}
          </fieldset>
          <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
            <legend className="sr-only">Label</legend>
            <span className="mr-1 text-xs font-medium text-muted-foreground">Label</span>
            {labels.map((l) => {
              const on = filters.labels.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...filters, labels: toggle(filters.labels, l.id) })}
                  className={`tap flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${on ? 'border-ring bg-primary-subtle' : 'border-input'}`}
                >
                  <span className={`h-2 w-2 rounded-full ${LABEL_BG[l.color] ?? 'bg-disabled-foreground'}`} />
                  {l.name}
                </button>
              );
            })}
          </fieldset>
          <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            Due
            <select
              value={filters.due ?? ''}
              onChange={(e) => onChange({ ...filters, due: (e.target.value || null) as DueFilter | null })}
              className="tap min-h-9 rounded-md border border-input bg-surface px-2 py-1 text-label text-foreground"
            >
              <option value="">Any time</option>
              <option value="overdue">Overdue</option>
              <option value="week">Due this week</option>
              <option value="none">No due date</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
