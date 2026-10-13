'use client';

import { useState } from 'react';
import { Avatar, LABEL_BG } from '@/components/ui';
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
    <div className="border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Filter cards"
          placeholder="Filter cards…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          className="tap w-40 rounded-md border border-slate-300 px-2 py-1 text-sm sm:w-56"
        />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`tap rounded-md px-2 py-1 text-sm ${active ? 'bg-blue-100 text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          Filters{active ? ' •' : ''}
        </button>
        {active ? (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="tap px-2 text-sm text-slate-600 underline">
            Clear
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="filter-panel">
          <fieldset className="flex items-center gap-1">
            <legend className="sr-only">Assignee</legend>
            <span className="mr-1 text-xs font-medium text-slate-500">Assignee</span>
            {members.map((m) => {
              const on = filters.assignees.includes(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Assigned to ${m.name}`}
                  onClick={() => onChange({ ...filters, assignees: toggle(filters.assignees, m.userId) })}
                  className={`tap flex items-center justify-center rounded-full p-0.5 ${on ? 'ring-2 ring-blue-600' : 'opacity-70 hover:opacity-100'}`}
                >
                  <Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={26} />
                </button>
              );
            })}
          </fieldset>
          <fieldset className="flex flex-wrap items-center gap-1">
            <legend className="sr-only">Label</legend>
            <span className="mr-1 text-xs font-medium text-slate-500">Label</span>
            {labels.map((l) => {
              const on = filters.labels.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ ...filters, labels: toggle(filters.labels, l.id) })}
                  className={`tap flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${on ? 'border-blue-600 bg-blue-50' : 'border-slate-300'}`}
                >
                  <span className={`h-2 w-2 rounded-full ${LABEL_BG[l.color] ?? 'bg-slate-400'}`} />
                  {l.name}
                </button>
              );
            })}
          </fieldset>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-500">
            Due
            <select
              value={filters.due ?? ''}
              onChange={(e) => onChange({ ...filters, due: (e.target.value || null) as DueFilter | null })}
              className="tap rounded-md border border-slate-300 bg-white px-1 py-0.5 text-sm text-slate-800"
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
