'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import type { Project } from '@/lib/types';

export default function ProjectIndex() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const router = useRouter();
  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });

  useEffect(() => {
    if (project.data) router.replace(`/w/${slug}/p/${projectId}/b/${project.data.defaultBoardId}`);
  }, [project.data, router, slug, projectId]);

  return project.error ? <p className="p-8 text-center">Project not found.</p> : <Spinner />;
}
