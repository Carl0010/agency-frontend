'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project, ProjectStar } from '@/lib/types';

export function ProjectStarButton({ project }: { project: Project }) {
  const qc = useQueryClient(); const toast = useToast();
  const star = useMutation({ mutationFn: () => project.starredByMe ? api.del<ProjectStar>(`/projects/${project.id}/star`) : api.put<ProjectStar>(`/projects/${project.id}/star`), onSuccess: async (saved) => {
    qc.setQueriesData<Page<Project>>({ queryKey: ['projects'] }, (page) => page ? { ...page, data: page.data.map((item) => item.id === saved.projectId ? { ...item, starredByMe: saved.starredByMe } : item) } : page);
    qc.setQueryData<Project>(['project', saved.projectId], (item) => item ? { ...item, starredByMe: saved.starredByMe } : item);
    await qc.invalidateQueries({ queryKey: ['projects'] });
  }, onError: (error) => toast(errorMessage(error)) });
  return <button type="button" className="ui-nav-link tap w-full" disabled={star.isPending} aria-label={`${project.starredByMe ? 'Unstar' : 'Star'} ${project.name}`} onClick={() => star.mutate()}><Icon name="star" /><span>{star.isPending ? 'Saving star…' : project.starredByMe ? 'Unstar project' : 'Star project'}</span></button>;
}
