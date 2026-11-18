'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Page, Team } from './types';

export function useTeams(workspaceId: string, archived = false) {
  return useQuery({ queryKey: ['teams', workspaceId, { archived }], queryFn: ({ signal }) => api.get<Page<Team>>(`/workspaces/${workspaceId}/teams${archived ? '?archived=true' : ''}`, signal) });
}

export function defaultTeamIds(teams: Team[]): string[] {
  const own = teams.filter((team) => !team.archivedAt && team.myRole !== null);
  return (own.length ? own : teams.filter((team) => !team.archivedAt && team.name === 'Everyone')).slice(0, 50).map((team) => team.id);
}
