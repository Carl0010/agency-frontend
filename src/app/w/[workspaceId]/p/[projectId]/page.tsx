'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';

export default function ProjectIndex() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const router = useRouter();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });

  useEffect(() => {
    if (project.data) router.replace(`/w/${workspaceId}/p/${projectId}/b/${project.data.defaultBoardId}`);
  }, [project.data, router, workspaceId, projectId]);

  return project.error ? <p className="p-8 text-center">Project not found.</p> : <LoadingSkeleton variant="cards" className="p-4 sm:p-6" />;
}
