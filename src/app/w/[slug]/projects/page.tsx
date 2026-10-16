'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Spinner, PageHeader, EmptyState, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { Icon } from '@/components/icon';
import { useTeams } from '@/lib/teams';
import { ProjectEditor } from '@/components/projects/project-editor';
import { ProjectIcon } from '@/components/projects/project-icon';
import { ProjectMenu } from '@/components/projects/project-menu';

export default function ProjectsPage() {
  const ws = useWorkspace(); const router = useRouter(); const params = useSearchParams();
  const [creating, setCreating] = useState(false); const teams = useTeams(ws.id);
  const team = params.get('team') ?? '';
  const projects = useQuery({ queryKey: team ? ['projects', ws.id, { team }] : ['projects', ws.id], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects${team ? `?team=${encodeURIComponent(team)}` : ''}`) });
  return <main className="ui-page">
    <PageHeader title="Projects" description="The projects shared with you and your teams." actions={<>
      <Link href={`/w/${ws.slug}/import`} className="ui-button tap text-secondary-foreground hover:bg-subtle"><Icon name="import" />Import from Trello</Link><Button onClick={() => setCreating(true)}><Icon name="plus" />New project</Button>
    </>} />
    <label className="mb-5 block max-w-xs space-y-1 text-label"><span>Team</span><Select aria-label="Filter projects by team" value={team} onChange={(event) => router.push(`/w/${ws.slug}/projects${event.target.value ? `?team=${encodeURIComponent(event.target.value)}` : ''}`)}><option value="">All available projects</option>{(teams.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
    {projects.isPending ? <Spinner /> : projects.error ? <div role="alert" className="space-y-3"><p>{errorMessage(projects.error)}</p><Button variant="secondary" onClick={() => void projects.refetch()}>Retry projects</Button></div> : projects.data.data.length ? <ul className="grid gap-3 sm:grid-cols-2">{projects.data.data.map((project) => <li key={project.id} className="ui-panel flex items-center gap-2 p-3 hover:border-border-hover">
      <Link href={`/w/${ws.slug}/p/${project.id}/b/${project.defaultBoardId}`} data-tour="project" className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-md"><ProjectIcon project={project} /><span className="min-w-0"><span className="block truncate font-medium">{project.name}</span><span className="text-caption text-muted-foreground">{project.key}{project.starredByMe ? ' · Starred' : ''}</span></span></Link><ProjectMenu project={project} />
    </li>)}</ul> : <EmptyState title="No projects shared with you yet" description="Ask a project admin to share a project or add you to a team, or create your own project." action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setCreating(true)}>Create project</Button><Button variant="secondary" onClick={() => { void projects.refetch(); void teams.refetch(); }}>Refresh projects</Button></div>} />}
    {creating ? <ProjectEditor onClose={() => setCreating(false)} onSaved={(project) => { setCreating(false); router.push(`/w/${ws.slug}/p/${project.id}/b/${project.defaultBoardId}`); }} /> : null}
  </main>;
}
