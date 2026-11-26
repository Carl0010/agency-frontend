'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { AvatarStack, useRoster } from '@/components/people/person-card';
import { Avatar, Badge, Button, EmptyState, Input, MultiCombobox } from '@/components/ui';
import { api } from '@/lib/api';
import { namesSentence } from '@/lib/names';
import { teamMatches } from '@/lib/teams';
import type { Team, TeamDetail } from '@/lib/types';

/** Team details carry the people; the list reads them per team (see docs/handoffs/TEAMS_AND_PROJECTS_LISTS.md). */
export function useTeamDetails(teams: Team[]) {
  return useQueries({
    queries: teams.map((team) => ({ queryKey: ['team', team.id], queryFn: ({ signal }: { signal: AbortSignal }) => api.get<TeamDetail>(`/teams/${team.id}`, signal), staleTime: 30_000 })),
  });
}

/**
 * The teams table: search by team or person, filter by people from the workspace roster, then one
 * row per team with its people as avatars (each opening a person card) and their names. Search and
 * people live in the URL (`?q=`, `?people=`).
 */
export function TeamsList({ teams, hrefFor, actions }: { teams: Team[]; hrefFor: (team: Team) => string; actions?: ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  // Typing stays local so the field never lags behind the URL; the URL follows for links and reloads.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const people = useMemo(() => (params.get('people') ?? '').split(',').filter(Boolean), [params]);
  const { roster, byId } = useRoster();
  const details = useTeamDetails(teams);
  const emails = useMemo(() => new Map([...byId].map(([id, member]) => [id, member.email])), [byId]);

  const set = (next: { q?: string; people?: string[] }) => {
    const search = new URLSearchParams(params);
    if (next.q !== undefined) setQuery(next.q);
    const q = next.q ?? query; const p = next.people ?? people;
    if (q) search.set('q', q); else search.delete('q');
    if (p.length) search.set('people', p.join(',')); else search.delete('people');
    const text = search.toString();
    router.replace(`${pathname}${text ? `?${text}` : ''}`, { scroll: false });
  };

  const rows = teams.map((team, index) => ({ team, detail: details[index] }));
  const shown = rows.filter(({ team, detail }) => teamMatches(team, detail?.data?.members, emails, query, people));
  const waiting = people.length > 0 && rows.some(({ detail }) => detail?.isPending);
  const options = (roster.data?.data ?? []).filter((member) => member.status !== 'deactivated').map((member) => ({
    value: member.userId, label: member.name, description: member.email,
    icon: <span aria-hidden="true" className="flex"><Avatar person={{ id: member.userId, name: member.name, avatarUrl: member.avatarUrl }} size={16} plain /></span>,
  }));
  const filtered = Boolean(query || people.length);

  return <section aria-label="Teams" className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative sm:w-80">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search for teams or people" placeholder="Search for teams or people" value={query} onChange={(event) => set({ q: event.target.value })} className="pl-9" />
      </div>
      <MultiCombobox aria-label="Filter by people" placeholder={people.length ? 'Add person…' : 'Filter by people…'} emptyText="No one matches"
        options={options} values={people} onChange={(values) => set({ people: values })} className="min-w-0 sm:w-80" />
      {actions ? <div className="flex gap-2 sm:ml-auto">{actions}</div> : null}
    </div>

    {shown.length ? <div className="ui-panel overflow-hidden" role="table" aria-label="Teams" aria-rowcount={shown.length + 1}>
      <div role="row" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem] gap-4 border-b border-border bg-subtle px-4 py-2 text-caption font-medium text-muted-foreground sm:grid">
        <span role="columnheader">Teams ({shown.length})</span><span role="columnheader">Members</span><span role="columnheader" aria-hidden="true" />
      </div>
      {shown.map(({ team, detail }) => {
        const members = detail?.data?.members;
        return <div key={team.id} role="row" data-testid="team-row" className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0 hover:bg-subtle sm:min-h-16 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem]">
          <span role="cell" className="flex min-w-0 items-center gap-3">
            <Avatar person={{ id: team.id, name: team.name, avatarUrl: null }} size={32} plain />
            {/* The stretched link makes the whole row open the team; avatars sit above it. */}
            <Link href={hrefFor(team)} className="min-w-0 truncate font-medium after:absolute after:inset-0 after:content-['']">{team.name}</Link>
            {team.archivedAt ? <Badge>Archived</Badge> : null}
          </span>
          <span role="cell" className="col-span-2 flex min-w-0 items-center gap-3 pl-11 sm:col-span-1 sm:pl-0">
            {members ? members.length ? <>
              <AvatarStack people={members} label={`People in ${team.name}`} />
              <span className="hidden min-w-0 truncate text-label text-muted-foreground md:block">{namesSentence(members.map((member) => member.name))}</span>
            </> : <span className="text-label text-muted-foreground">No one yet</span>
              : detail?.isError ? <span className="text-label text-muted-foreground">{team.memberCount} {team.memberCount === 1 ? 'person' : 'people'}</span>
              : <span aria-label="Loading people" className="flex -space-x-1.5">{[0, 1, 2].slice(0, Math.max(1, Math.min(3, team.memberCount))).map((n) => <span key={n} className="size-7 animate-pulse rounded-full bg-muted ring-2 ring-surface motion-reduce:animate-none" />)}</span>}
          </span>
          <span role="cell" aria-hidden="true" className="col-start-2 row-start-1 text-muted-foreground sm:col-start-auto sm:row-start-auto"><Icon name="chevron" className="size-4" /></span>
        </div>;
      })}
    </div> : waiting ? <p role="status" className="text-label text-muted-foreground">Finding teams…</p>
      : filtered ? <EmptyState icon="search" title="No teams match" description="Try another name, or remove a person from the filter." action={<Button variant="secondary" onClick={() => set({ q: '', people: [] })}>Clear search</Button>} />
      : null}
  </section>;
}
