'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { ProjectError } from '@/components/projects/project-error';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';

/** Every member project surface rechecks the authoritative project after access changes. */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: ({ signal }) => api.get<Project>(`/projects/${projectId}`, signal) });
  if (project.isPending) return <Spinner />;
  if (project.error) return <ProjectError error={project.error} retry={() => void project.refetch()} />;
  return children;
}
