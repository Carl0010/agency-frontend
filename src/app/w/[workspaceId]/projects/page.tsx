'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button, PageHeader, EmptyState, Input, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Assignable, Page, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { Icon } from '@/components/icon';
import { fold, useTeams } from '@/lib/teams';
import { AvatarStack } from '@/components/people/person-card';
import { ProjectEditor } from '@/components/projects/project-editor';
import { ProjectIcon } from '@/components/projects/project-icon';
import { ProjectMenu } from '@/components/projects/project-menu';
import { ProjectStatusPill } from '@/components/projects/project-status';
import { STATUS_FILTERS, statusFilter, statusParam } from '@/lib/project-status';

/**
 * Every project the caller can see, as a table: name, the people on it (`/projects/:id/assignable`,
 * each avatar opening a person card) and status. Search by name and the status filter stay in the
 * URL (`?q=`, `?status=`; Open by default, so completed and cancelled work steps aside); a sidebar
 * team heading links here with `?team=`, shown as a removable chip.
 */
export default function ProjectsPage() {
  const ws = useWorkspace(); const router = useRouter(); const params = useSearchParams(); const qc = useQueryClient();
  const [creating, setCreating] = useState(false); const teams = useTeams(ws.id);
  const team = params.get('team') ?? '';
  const status = statusFilter(params.get('status'));
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const apiQuery = [team ? `team=${encodeURIComponent(team)}` : '', statusParam(status) ? `status=${statusParam(status)}` : ''].filter(Boolean).join('&');
  const projects = useQuery({ queryKey: ['projects', ws.id, { team, status }], queryFn: ({ signal }) => api.get<Page<Project>>(`/workspaces/${ws.id}/projects${apiQuery ? `?${apiQuery}` : ''}`, signal) });
  const list = projects.data?.data ?? [];
  const people = useQueries({ queries: list.map((project) => ({ queryKey: ['assignable', project.id], queryFn: ({ signal }: { signal: AbortSignal }) => api.get<Page<Assignable>>(`/projects/${project.id}/assignable`, signal), staleTime: 30_000 })) });
  const go = (next: { team?: string; q?: string; status?: string }) => {
    const search = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) { if (value) search.set(key, value); else search.delete(key); }
    if (next.q !== undefined) setQuery(next.q);
    const text = search.toString();
    router.replace(`/w/${ws.id}/projects${text ? `?${text}` : ''}`, { scroll: false });
  };
  const teamName = teams.data?.data.find((item) => item.id === team)?.name;
  const rows = list.map((project, index) => ({ project, people: people[index] })).filter(({ project }) => fold(project.name).includes(fold(query)));

  return <main className="ui-page max-w-6xl">
    <PageHeader title="Projects" actions={<>
      <Link href={`/w/${ws.id}/import`} title="Import from Trello" className="ui-button tap text-secondary-foreground hover:bg-subtle"><Icon name="import" /><span className="sr-only sm:not-sr-only">Import from Trello</span></Link><Button onClick={() => setCreating(true)}><Icon name="plus" />New project</Button>
    </>} />
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative sm:w-96">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Find a project" placeholder="Find a project" value={query} onChange={(event) => go({ q: event.target.value })} className="pl-9" />
      </div>
      <Select aria-label="Project status" value={status} onChange={(value) => go({ status: value === 'open' ? '' : value })} options={STATUS_FILTERS} className="sm:w-40" />
      {team ? <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-surface py-0.5 pl-3 pr-1 text-label">
        Shared with {teamName ?? 'a team'}
        <button type="button" aria-label="Show all projects" onClick={() => go({ team: '' })} className="tap inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-subtle hover:text-foreground"><Icon name="close" className="size-3.5" /></button>
      </span> : null}
    </div>

    {projects.isPending ? <LoadingSkeleton variant="rows" label="Loading projects" />
      : projects.error ? <div role="alert" className="space-y-3"><p>{errorMessage(projects.error)}</p><Button variant="secondary" onClick={() => void projects.refetch()}>Retry projects</Button></div>
      : rows.length ? <div className="ui-panel overflow-hidden" role="table" aria-label="Projects">
        <div role="row" className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem_2.75rem] gap-4 border-b border-border bg-subtle px-4 py-2 text-caption font-medium text-muted-foreground sm:grid">
          <span role="columnheader">Name</span><span role="columnheader">Members</span><span role="columnheader">Status</span><span role="columnheader"><span className="sr-only">Actions</span></span>
        </div>
        {rows.map(({ project, people: members }) => <div key={project.id} role="row" data-testid="project-row" className="relative grid grid-cols-[minmax(0,1fr)_auto_2.75rem] items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-subtle sm:min-h-14 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_8rem_2.75rem] sm:gap-x-4">
          <span role="cell" className="flex min-w-0 items-center gap-3">
            <ProjectIcon project={project} />
            {/* The stretched link opens the board from anywhere in the row; avatars and the menu sit above it. */}
            <Link href={`/w/${ws.id}/p/${project.id}/b/${project.defaultBoardId}`} data-tour="project" className="min-w-0 truncate font-medium after:absolute after:inset-0 after:content-['']">{project.name}</Link>
          </span>
          <span role="cell" className="col-span-3 row-start-2 flex min-w-0 pl-10 sm:col-span-1 sm:row-start-auto sm:pl-0">
            {members?.data ? <AvatarStack people={members.data.data} label={`People on ${project.name}`} size={26} />
              : members?.isError ? null
              : <span aria-label="Loading people" className="flex -space-x-1.5">{[0, 1].map((n) => <span key={n} className="size-[26px] animate-pulse rounded-full bg-muted ring-2 ring-surface motion-reduce:animate-none" />)}</span>}
          </span>
          <span role="cell" className="flex"><ProjectStatusPill project={project} compact /></span>
          <span role="cell" className="relative z-10 flex justify-end"><ProjectMenu project={project} /></span>
        </div>)}
      </div>
      : query ? <EmptyState icon="search" title="No projects match" description={`Nothing is named like “${query}”.`} action={<Button variant="secondary" onClick={() => go({ q: '' })}>Clear search</Button>} />
      : status === 'completed' || status === 'cancelled' ? <EmptyState icon="projects" title={`No ${status} projects`} description="Projects appear here when their status is set, until someone archives them." action={<Button variant="secondary" onClick={() => go({ status: 'all' })}>Show all projects</Button>} />
      : team ? <EmptyState icon="projects" title={`No projects shared with ${teamName ?? 'this team'}`} description="A project admin can share projects with the team." action={<Button variant="secondary" onClick={() => go({ team: '' })}>Show all projects</Button>} />
      : <EmptyState title="No projects shared with you yet" description="Ask a project admin to share a project or add you to a team, or create your own project." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setCreating(true)}>Create project</Button><Button variant="secondary" onClick={() => { void qc.invalidateQueries({ queryKey: ['projects', ws.id] }); void teams.refetch(); }}>Refresh projects</Button></div>} />}
    {creating ? <ProjectEditor onClose={() => setCreating(false)} onSaved={(project) => { setCreating(false); router.push(`/w/${ws.id}/p/${project.id}/b/${project.defaultBoardId}`); }} /> : null}
  </main>;
}
