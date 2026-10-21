'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { CoachMarks } from '@/components/onboarding/tour';
import { CommandPalette } from '@/components/search/command-palette';
import { WorkspaceShell } from '@/components/navigation/workspace-shell';
import { api, ApiError } from '@/lib/api';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { Workspace } from '@/lib/types';
import { WorkspaceContext } from '@/lib/workspace';
import { canonicalWorkspaceUrl, workspaceLookupPath } from '@/lib/workspace-url';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (user === null) {
      const next = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      // Leave the protected tree entirely and clear its hash from the login URL.
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, pathname, query]);

  const ws = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => api.get<Workspace>(workspaceLookupPath(workspaceId)),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (!ws.data) return;
    if (ws.data.role === 'guest') {
      router.replace('/portal');
      return;
    }
    rememberWorkspace(ws.data.id);
    if (workspaceId !== ws.data.id) {
      // A fresh route tree starts nested card routes cleanly after resolving a legacy alias.
      window.location.replace(canonicalWorkspaceUrl(window.location.pathname, ws.data.id, window.location.search, window.location.hash));
    }
  }, [ws.data, workspaceId, router]);

  if (!user || ws.isPending) return <LoadingSkeleton variant="cards" className="p-4 sm:p-6" />;
  if (ws.error) {
    const missing = ws.error instanceof ApiError && ws.error.status === 404;
    return (
      <main className="p-8 text-center">
        <h1 className="text-lg font-semibold">{missing ? 'Workspace not found' : 'Could not load workspace'}</h1>
        <Link className="text-primary" href="/">
          Go home
        </Link>
      </main>
    );
  }

  if (ws.data.role === 'guest' || workspaceId !== ws.data.id) return <LoadingSkeleton variant="cards" className="p-4 sm:p-6" />;

  return (
    <WorkspaceContext.Provider value={ws.data}>
      <WorkspaceShell>{children}</WorkspaceShell>
      <CommandPalette />
      <CoachMarks />
    </WorkspaceContext.Provider>
  );
}
