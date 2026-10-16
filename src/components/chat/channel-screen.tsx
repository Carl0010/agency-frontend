'use client';

import { useQuery } from '@tanstack/react-query';
import { ProjectActions } from '@/components/project-chrome';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import type { ChannelKind, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { ChannelPane } from './channel-pane';
import { ProjectError } from '@/components/projects/project-error';

/** A project channel inside the workspace shell, with local sharing actions (§3.4). */
export function ChannelScreen({ projectId, kind }: { projectId: string; kind: ChannelKind }) {
  const ws = useWorkspace();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });

  if (project.isPending) return <Spinner />;
  if (project.error) return <ProjectError error={project.error} retry={() => void project.refetch()} />;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{project.data.name}</h1>
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
          linkBase={`/w/${ws.slug}/p/${projectId}/${kind === 'shared' ? 'chat' : 'team'}`}
        />
      </div>
    </div>
  );
}
