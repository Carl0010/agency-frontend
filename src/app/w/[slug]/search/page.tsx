'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { countLabel, Snippet, TYPE_LABEL } from '@/components/search/snippet';
import { Button, Input, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/time';
import type { Member, Page, Project, SearchResult, SearchType } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';

const TYPES: SearchType[] = ['card', 'comment', 'message'];

/**
 * `/w/[slug]/search?q=` (§5.4): full results with filters for type, project,
 * author and date range. Every filter is URL state.
 */
function SearchScreen() {
  const ws = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const projects = useQuery({ queryKey: ['projects', ws.id], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`) });
  const members = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });

  const apiQuery = new URLSearchParams();
  apiQuery.set('q', q);
  for (const t of params.getAll('type')) apiQuery.append('type', t);
  const project = params.get('project');
  if (project) apiQuery.set('projectId', project);
  const author = params.get('author');
  if (author) apiQuery.set('authorId', author);
  const from = params.get('from');
  if (from) apiQuery.set('from', new Date(`${from}T00:00:00`).toISOString());
  const to = params.get('to');
  if (to) apiQuery.set('to', new Date(`${to}T23:59:59`).toISOString());
  if (params.get('archived') === '1') apiQuery.set('includeArchived', 'true');
  const offset = params.get('offset');
  if (offset) apiQuery.set('offset', offset);

  const results = useQuery({
    queryKey: ['search', ws.id, 'page', apiQuery.toString()],
    queryFn: ({ signal }) => api.get<SearchResult>(`/workspaces/${ws.id}/search?${apiQuery.toString()}`, signal),
    enabled: q.trim().length >= 1,
  });

  function set(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('offset' in changes)) next.delete('offset');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    set({ q: draft.trim() });
  }

  const typeFilter = params.getAll('type');
  const shown = typeFilter.length ? TYPES.filter((t) => typeFilter.includes(t)) : TYPES;

  return (
    <main className="mx-auto max-w-4xl p-4">
      <form onSubmit={onSubmit} className="mb-3 flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Search" placeholder='Search… "exact phrase" -exclude' />
        <Button type="submit">Search</Button>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Filters">
        <select aria-label="Type" value={typeFilter[0] ?? ''} onChange={(e) => set({ type: e.target.value || null })} className="tap rounded-md border border-input px-2">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select aria-label="Project" value={project ?? ''} onChange={(e) => set({ project: e.target.value || null })} className="tap rounded-md border border-input px-2">
          <option value="">All projects</option>
          {(projects.data?.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Author" value={author ?? ''} onChange={(e) => set({ author: e.target.value || null })} className="tap rounded-md border border-input px-2">
          <option value="">Anyone</option>
          {(members.data?.data ?? [])
            .filter((m) => m.status !== 'invited')
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
        </select>
        <label className="flex items-center gap-1">
          From <input type="date" value={from ?? ''} onChange={(e) => set({ from: e.target.value || null })} className="tap rounded-md border border-input px-2" />
        </label>
        <label className="flex items-center gap-1">
          To <input type="date" value={to ?? ''} onChange={(e) => set({ to: e.target.value || null })} className="tap rounded-md border border-input px-2" />
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={params.get('archived') === '1'} onChange={(e) => set({ archived: e.target.checked ? '1' : null })} />
          Include archived cards
        </label>
      </div>
      {!q ? (
        <p className="text-sm text-muted-foreground">Search cards, comments and messages across every project.</p>
      ) : results.isPending ? (
        <Spinner label="Searching…" />
      ) : results.error ? (
        <p className="text-secondary-foreground">{errorMessage(results.error)}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-secondary-foreground" data-testid="search-counts">
            {TYPES.map((t) => `${TYPE_LABEL[t]} (${countLabel(results.data.groups[t])})`).join(' · ')}
            {results.data.fallback ? ' — no exact matches; showing cards with similar titles' : ''}
          </p>
          {shown.map((t) => {
            const g = results.data.groups[t];
            if (g.items.length === 0) return null;
            return (
              <section key={t} className="mb-5" aria-label={TYPE_LABEL[t]}>
                <h2 className="mb-1 text-sm font-semibold text-secondary-foreground">
                  {TYPE_LABEL[t]} ({countLabel(g)})
                </h2>
                <ul className="divide-y divide-border-subtle rounded-md border border-border bg-surface">
                  {g.items.map((hit) => (
                    <li key={hit.id} data-testid="search-result">
                      <Link href={hit.url} className="block px-3 py-2 hover:bg-background">
                        <div className="flex items-baseline gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{hit.projectName}</span>
                          {hit.author ? <span>· {hit.author.name}</span> : null}
                          <span className="ml-auto shrink-0">{timeAgo(hit.createdAt, now)}</span>
                        </div>
                        <div className="truncate text-sm font-medium">{hit.title}</div>
                        <Snippet parts={hit.snippet} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {g.nextOffset !== null && shown.length === 1 ? (
                  <Button variant="secondary" className="mt-2" onClick={() => set({ offset: String(g.nextOffset) })}>
                    Next {TYPE_LABEL[t].toLowerCase()}
                  </Button>
                ) : g.nextOffset !== null ? (
                  <button type="button" className="mt-1 text-sm text-primary hover:underline" onClick={() => set({ type: t })}>
                    More {TYPE_LABEL[t].toLowerCase()}…
                  </button>
                ) : null}
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchScreen />
    </Suspense>
  );
}
