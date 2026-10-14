'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { FormError } from '@/components/auth-card';
import { Button, Input } from '@/components/ui';
import { api } from '@/lib/api';
import { initialChoices, type MemberChoices } from '@/lib/import';
import type { ImportPreview, Member, Page, Project } from '@/lib/types';
import { DropReport } from './drop-report';

export type ImportTarget = { kind: 'new'; name: string } | { kind: 'existing'; projectId: string };

/**
 * Preview counts, the member-mapping screen and the target project (§7.1
 * steps 2–4). Unmatched Trello members can only be mapped to an existing
 * member or left unassigned — never invited (AC24).
 */
export function ImportPreviewScreen({
  preview,
  workspaceId,
  submitting,
  submitError,
  onBack,
  onConfirm,
}: {
  preview: ImportPreview;
  workspaceId: string;
  submitting: boolean;
  submitError: string | null;
  onBack: () => void;
  onConfirm: (target: ImportTarget, choices: MemberChoices) => void;
}) {
  const [choices, setChoices] = useState<MemberChoices>(() => initialChoices(preview.members));
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState(preview.boardName ?? '');
  const [projectId, setProjectId] = useState('');

  const members = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => api.get<Page<Member>>(`/workspaces/${workspaceId}/members`),
  });
  const projects = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: () => api.get<Page<Project>>(`/workspaces/${workspaceId}/projects`),
  });
  // Only active non-guest members can be assigned (§6.1).
  const assignable = (members.data?.data ?? []).filter((m) => m.status === 'active' && m.role !== 'guest');
  const openProjects = (projects.data?.data ?? []).filter((p) => !p.archivedAt);
  const unmatched = preview.members.filter((m) => !(choices[m.externalId] ?? '')).length;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(mode === 'new' ? { kind: 'new', name: name.trim() } : { kind: 'existing', projectId }, choices);
  }

  const howLabel = { email: 'matched by email', name: 'matched by name', manual: 'chosen', null: '' } as const;

  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="import-preview">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium">{preview.boardName ?? 'Trello board'}</h2>
        <p className="mt-1 text-slate-800" data-testid="import-summary">
          {preview.summary}
        </p>
        {preview.counts.archivedCards > 0 ? (
          <p className="mt-1 text-sm text-slate-600">Includes {preview.counts.archivedCards} archived cards, which arrive archived.</p>
        ) : null}
        {preview.notices.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {preview.notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        {preview.limit ? (
          <p role="alert" data-testid="import-limit" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {preview.limit.message} Split the board in Trello, then import each part.
          </p>
        ) : null}
      </section>

      {preview.members.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4" data-testid="member-mapping">
          <h2 className="font-medium">Members</h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">
            Match Trello members to your team so their cards stay assigned. Anyone left unassigned is not invited and takes no seat.
            {unmatched ? ` ${unmatched} not matched yet.` : ''}
          </p>
          <ul className="divide-y divide-slate-200">
            {preview.members.map((m) => {
              const chosen = choices[m.externalId] ?? '';
              return (
                <li key={m.externalId} data-testid="member-map-row" className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block text-xs text-slate-500">
                      {chosen && chosen === m.userId ? howLabel[m.how ?? 'null'] : chosen ? 'chosen' : 'not matched'}
                    </span>
                  </span>
                  <select
                    aria-label={`Match ${m.name}`}
                    value={chosen}
                    onChange={(e) => setChoices({ ...choices, [m.externalId]: e.target.value })}
                    className="tap rounded-md border border-slate-300 bg-white px-2 text-sm"
                  >
                    <option value="">Leave unassigned</option>
                    {assignable.map((a) => (
                      <option key={a.userId} value={a.userId}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Import into</h2>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="target" checked={mode === 'new'} onChange={() => setMode('new')} />A new project
          </label>
          {mode === 'new' ? (
            <Input
              aria-label="New project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={preview.boardName ?? 'Trello import'}
              maxLength={120}
            />
          ) : null}
          <label className="flex items-center gap-2">
            <input type="radio" name="target" checked={mode === 'existing'} onChange={() => setMode('existing')} disabled={!openProjects.length} />
            An existing project
          </label>
          {mode === 'existing' ? (
            <select
              aria-label="Existing project"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="tap w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">Choose a project…</option>
              {openProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <p className="text-xs text-slate-500">Importing the same board again updates what it brought in; it never duplicates cards or moves ones you have moved.</p>
        </div>
      </section>

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-medium">What Trello data won’t come over</summary>
        <DropReport drops={preview.dropped} />
      </details>

      <FormError message={submitError} />
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || Boolean(preview.limit) || (mode === 'existing' && !projectId)}>
          {submitting ? 'Starting…' : 'Start import'}
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Start over
        </Button>
      </div>
    </form>
  );
}
