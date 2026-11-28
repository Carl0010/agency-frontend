'use client';

import { useEffect, useState } from 'react';

/** How many recently opened projects one browser remembers per workspace. */
export const RECENT_LIMIT = 20;

const key = (workspaceId: string) => `agency:recentProjects:${workspaceId}`;

/** Pure: `projectId` moved to the front, without repeats, at most `RECENT_LIMIT` long. */
export function pushRecent(ids: readonly string[], projectId: string): string[] {
  return [projectId, ...ids.filter((id) => id !== projectId)].slice(0, RECENT_LIMIT);
}

/** Pure: projects most recently opened first; the rest keep their order after them. */
export function orderByRecent<T extends { id: string }>(projects: readonly T[], recent: readonly string[]): T[] {
  const rank = new Map(recent.map((id, index) => [id, index]));
  return projects
    .map((project, index) => ({ project, index, rank: rank.get(project.id) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.project);
}

function read(workspaceId: string): string[] {
  try {
    const raw = window.localStorage.getItem(key(workspaceId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The projects this browser opened lately in the workspace, newest first. A per-viewer convenience
 * kept in local storage: it can come back empty, and the sidebar then keeps the API's order.
 */
export function useRecentProjects(workspaceId: string, currentProjectId?: string): string[] {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    const stored = read(workspaceId);
    const next = currentProjectId ? pushRecent(stored, currentProjectId) : stored;
    setRecent(next);
    if (!currentProjectId) return;
    try {
      window.localStorage.setItem(key(workspaceId), JSON.stringify(next));
    } catch {
      // Private windows and blocked storage: recents just stay in memory.
    }
  }, [workspaceId, currentProjectId]);
  return recent;
}
