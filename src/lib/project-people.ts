'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Member, Page } from './types';

export function useProjectPeople(workspaceId: string, projectId: string) {
  return useQuery({ queryKey: ['project-people', workspaceId, projectId], queryFn: ({ signal }) => api.get<Page<Member>>(`/workspaces/${workspaceId}/members?mentionable=true&projectId=${encodeURIComponent(projectId)}&surface=card`, signal) });
}
