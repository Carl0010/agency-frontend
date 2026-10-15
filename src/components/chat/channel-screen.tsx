'use client';

import { useQuery } from '@tanstack/react-query';
import { ProjectActions } from '@/components/project-chrome';
import { Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { ChannelKind, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { ChannelPane } from './channel-pane';

/** A project channel inside the workspace shell, with local sharing actions (§3.4). */
export function ChannelScreen({ projectId, kind }: { projectId: string; kind: ChannelKind }) {
  const ws = useWorkspace();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });

  if (project.isPending) return <Spinner />;
  if (project.error) return <p className="p-8 text-center text-secondary-foreground">{errorMessage(project.error)}</p>;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{project.data.name}</h1>
            {project.data.clientName ? <p className="truncate text-xs text-muted-foreground">{project.data.clientName}</p> : null}
          </div>
          <div className="ml-2">
            <ProjectActions projectId={projectId} />
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
