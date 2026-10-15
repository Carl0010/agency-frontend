'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useUserEvent } from './realtime';
import { useSession } from './session';
import type { Channel, Page } from './types';
import { useWorkspace } from './workspace';

export const channelsKey = (workspaceId: string) => ['channels', workspaceId] as const;

/**
 * Every channel in the workspace with the caller's unread count (AC5): drives
 * the dots on sidebar projects and their Chat/Team destinations. Kept live by the
 * per-user `channel.activity` / `channel.read` events, so a read in one
 * session clears the dot in every other session of the same user.
 */
export function useWorkspaceChannels() {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const { user } = useSession();
  const query = useQuery({
    queryKey: channelsKey(ws.id),
    queryFn: () => api.get<{ data: Channel[] }>(`/workspaces/${ws.id}/channels`),
  });

  useUserEvent<{ channelId: string; authorId: string; createdAt: string }>('channel.activity', (e) => {
    if (e.authorId === user?.id) return;
    qc.setQueryData<{ data: Channel[] }>(channelsKey(ws.id), (old) =>
      old
        ? {
            data: old.data.map((c) =>
              c.id === e.channelId ? { ...c, unreadCount: c.unreadCount + 1, lastMessageAt: e.createdAt } : c,
            ),
          }
        : old,
    );
  });
  useUserEvent<{ channelId: string; unreadCount: number; lastReadMessageAt: string | null }>('channel.read', (e) => {
    qc.setQueryData<{ data: Channel[] }>(channelsKey(ws.id), (old) =>
      old
        ? {
            data: old.data.map((c) =>
              c.id === e.channelId ? { ...c, unreadCount: e.unreadCount, lastReadMessageAt: e.lastReadMessageAt } : c,
            ),
          }
        : old,
    );
  });

  const channels = query.data?.data ?? [];
  return {
    channels,
    forProject: (projectId: string) => channels.filter((c) => c.projectId === projectId),
    projectUnread: (projectId: string) => channels.some((c) => c.projectId === projectId && c.unreadCount > 0),
  };
}

export type { Page };
