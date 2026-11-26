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

/** Lower-case and strip accents so "jose" finds "José". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Whether a team passes the Teams list's search and people filter. Search matches the team name or
 * any member's name or email. The people filter keeps teams that include every chosen person; while
 * a team's members are still loading (`members` undefined), only its name can match.
 */
export function teamMatches(
  team: { name: string },
  members: { userId: string; name: string }[] | undefined,
  emails: ReadonlyMap<string, string>,
  query: string,
  people: readonly string[],
): boolean {
  if (people.length && (!members || !people.every((id) => members.some((member) => member.userId === id)))) return false;
  const q = fold(query);
  if (!q) return true;
  if (fold(team.name).includes(q)) return true;
  return (members ?? []).some((member) => fold(member.name).includes(q) || fold(emails.get(member.userId) ?? '').includes(q));
}
