'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';
import { Button } from '@/components/ui';
import { Icon } from '@/components/icon';
import { ProjectSharing } from '@/components/projects/project-sharing';

/** Project-level actions (§3.2); navigation is owned by the workspace sidebar. */
export function ProjectActions({ projectId }: { projectId: string }) {
  const [sharing, setSharing] = useState(false);
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });
  if (project.data?.access !== 'admin' || project.error) return null;
  return <><Button variant="ghost" data-testid="guests-button" onClick={() => setSharing(true)}><Icon name="people" />Share</Button>{sharing ? <ProjectSharing project={project.data} onClose={() => setSharing(false)} /> : null}</>;
}
