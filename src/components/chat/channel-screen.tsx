'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ProjectRail, ProjectTabs } from '@/components/project-chrome';
import { Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { ChannelKind, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { ChannelPane } from './channel-pane';

/** A project channel inside the workspace: project rail, `Board | Chat | Team` tabs, then the channel (§3.4). */
export function ChannelScreen({ projectId, kind }: { projectId: string; kind: ChannelKind }) {
  const ws = useWorkspace();
  const [railOpen, setRailOpen] = useState(false);
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });

  if (project.isPending) return <Spinner />;
  if (project.error) return <p className="p-8 text-center text-slate-600">{errorMessage(project.error)}</p>;

  return (
    <div className="flex h-full">
      <ProjectRail open={railOpen} onClose={() => setRailOpen(false)} currentProjectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <button type="button" aria-label="Projects" onClick={() => setRailOpen(true)} className="tap rounded px-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{project.data.name}</h1>
            {project.data.clientName ? <p className="truncate text-xs text-slate-500">{project.data.clientName}</p> : null}
          </div>
          <div className="ml-2">
            <ProjectTabs projectId={projectId} boardId={project.data.defaultBoardId} current={kind} />
          </div>
        </div>
        <ChannelPane
          projectId={projectId}
          kind={kind}
          audience="member"
          canPost
          linkBase={`/w/${ws.slug}/p/${projectId}/${kind === 'client' ? 'chat' : 'team'}`}
        />
      </div>
    </div>
  );
}
