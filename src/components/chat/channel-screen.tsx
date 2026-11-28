'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery } from '@tanstack/react-query';
import { ProjectActions } from '@/components/project-chrome';
import { ProjectIcon } from '@/components/projects/project-icon';
import { ProjectTabs } from '@/components/projects/project-tabs';
import { api } from '@/lib/api';
import type { ChannelKind, Project } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { ChannelPane } from './channel-pane';
import { ProjectError } from '@/components/projects/project-error';

/** A project channel inside the workspace shell, with local sharing actions (§3.4). */
export function ChannelScreen({ projectId, kind }: { projectId: string; kind: ChannelKind }) {
  const ws = useWorkspace();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });

  if (project.isPending) return <LoadingSkeleton variant="messages" className="p-4 sm:p-6" />;
  if (project.error) return <ProjectError error={project.error} retry={() => void project.refetch()} />;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-chrome px-3 py-1.5 sm:gap-2.5 sm:px-4 sm:py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
            <ProjectIcon project={project.data} />
            <h1 className="min-w-0 truncate text-body-lg font-semibold leading-6 sm:text-lg">{project.data.name}</h1>
            <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-border sm:block" />
            <ProjectTabs project={project.data} />
          </div>
          <ProjectActions projectId={projectId} />
        </div>
        <ChannelPane
          projectId={projectId}
          kind={kind}
          audience="member"
          canPost
          linkBase={`/w/${ws.id}/p/${projectId}/${kind === 'shared' ? 'chat' : 'team'}`}
        />
      </div>
    </div>
  );
}
