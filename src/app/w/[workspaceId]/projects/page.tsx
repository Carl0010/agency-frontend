'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button, PageHeader, EmptyState, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { Icon } from '@/components/icon';
import { useTeams } from '@/lib/teams';
import { ProjectEditor } from '@/components/projects/project-editor';
import { ProjectIcon } from '@/components/projects/project-icon';
import { ProjectMenu } from '@/components/projects/project-menu';
import { ProjectStatusPill } from '@/components/projects/project-status';
import { STATUS_FILTERS, statusFilter, statusParam, type StatusFilter } from '@/lib/project-status';

export default function ProjectsPage() {
  const ws = useWorkspace(); const router = useRouter(); const params = useSearchParams(); const qc = useQueryClient();
  const [creating, setCreating] = useState(false); const teams = useTeams(ws.id);
  const team = params.get('team') ?? '';
  const status = statusFilter(params.get('status'));
  // The API filters by status; closed projects are never fetched and hidden locally.
  const query = (next: { team?: string; status?: StatusFilter }) => {
    const search = new URLSearchParams();
    const t = next.team ?? team; const s = next.status ?? status;
    if (t) search.set('team', t);
    if (s !== 'open') search.set('status', s);
    return search.toString();
  };
  const apiQuery = new URLSearchParams();
  if (team) apiQuery.set('team', team);
  const statuses = statusParam(status);
  if (statuses) apiQuery.set('status', statuses);
  const projects = useQuery({ queryKey: ['projects', ws.id, { team, status }], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects${apiQuery.size ? `?${apiQuery.toString().replaceAll('%2C', ',')}` : ''}`) });
  const go = (next: { team?: string; status?: StatusFilter }) => { const search = query(next); router.push(`/w/${ws.id}/projects${search ? `?${search}` : ''}`); };
  return <main className="ui-page">
    <PageHeader title="Projects" description="The projects shared with you and your teams." actions={<>
      <Link href={`/w/${ws.id}/import`} className="ui-button tap text-secondary-foreground hover:bg-subtle"><Icon name="import" />Import from Trello</Link><Button onClick={() => setCreating(true)}><Icon name="plus" />New project</Button>
    </>} />
    <div className="mb-5 flex flex-wrap items-end gap-4">
    <label className="block w-full max-w-xs space-y-1 text-label"><span>Team</span><Select aria-label="Filter projects by team" value={team} onChange={(event) => go({ team: event.target.value })}><option value="">All available projects</option>{(teams.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
    <div role="group" aria-label="Filter projects by status" className="inline-flex rounded-lg border border-border bg-subtle p-0.5">{STATUS_FILTERS.map((filter) => <button key={filter.value} type="button" aria-pressed={status === filter.value} onClick={() => go({ status: filter.value })}
      className={`tap rounded-md px-3 py-1.5 text-label font-medium ${status === filter.value ? 'bg-surface text-foreground shadow-sm' : 'text-secondary-foreground hover:text-foreground'}`}>{filter.label}</button>)}</div>
    </div>
    {projects.isPending ? <LoadingSkeleton variant="cards" className="p-4 sm:p-6" /> : projects.error ? <div role="alert" className="space-y-3"><p>{errorMessage(projects.error)}</p><Button variant="secondary" onClick={() => void projects.refetch()}>Retry projects</Button></div> : projects.data.data.length ? <ul className="grid gap-3 sm:grid-cols-2">{projects.data.data.map((project) => <li key={project.id} className="ui-panel flex items-center gap-2 p-3 hover:border-border-hover">
      <Link href={`/w/${ws.id}/p/${project.id}/b/${project.defaultBoardId}`} data-tour="project" className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-md"><ProjectIcon project={project} /><span className="min-w-0"><span className="block truncate font-medium">{project.name}</span><span className="text-caption text-muted-foreground">{project.key}{project.starredByMe ? ' · Starred' : ''}</span></span></Link><ProjectStatusPill project={project} /><ProjectMenu project={project} />
    </li>)}</ul> : status === 'completed' || status === 'cancelled' ? <EmptyState icon="projects" title={`No ${status} projects`} description="Projects appear here when their status is set, until someone archives them." action={<Button variant="secondary" onClick={() => go({ status: 'all' })}>Show all projects</Button>} /> : <EmptyState title="No projects shared with you yet" description="Ask a project admin to share a project or add you to a team, or create your own project." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setCreating(true)}>Create project</Button><Button variant="secondary" onClick={() => { void qc.invalidateQueries({ queryKey: ['projects', ws.id] }); void teams.refetch(); }}>Refresh projects</Button></div>} />}
    {creating ? <ProjectEditor onClose={() => setCreating(false)} onSaved={(project) => { setCreating(false); router.push(`/w/${ws.id}/p/${project.id}/b/${project.defaultBoardId}`); }} /> : null}
  </main>;
}
