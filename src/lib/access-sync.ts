'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { refreshSession, errorMessage } from './api';
import { getSocket } from './realtime';
import { useToast } from '@/components/toast';

/** Clear readable snapshots on access changes, including content hidden in a route cache. */
export function useAccessSync() {
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => {
    const socket = getSocket();
    const refetch = () => { void qc.invalidateQueries(); };
    const changed = () => {
      // Drop project content immediately, while retaining unrelated form drafts.
      const sensitive = new Set(['project', 'projects', 'board', 'card', 'channels', 'messages', 'comments', 'search', 'notifications', 'project-access', 'project-guests', 'project-people', 'assignable']);
      void qc.resetQueries({ predicate: (query) => sensitive.has(String(query.queryKey[0])) });
      refetch();
      void refreshSession().catch((error: unknown) => toast(errorMessage(error)));
    };
    socket.on('access.changed', changed);
    socket.on('connect', refetch);
    return () => { socket.off('access.changed', changed); socket.off('connect', refetch); };
  }, [qc, toast]);
}
