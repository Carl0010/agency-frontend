'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { CoachMarks } from '@/components/onboarding/tour';
import { CommandPalette } from '@/components/search/command-palette';
import { Spinner } from '@/components/ui';
import { WorkspaceShell } from '@/components/navigation/workspace-shell';
import { api, ApiError } from '@/lib/api';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { Workspace } from '@/lib/types';
import { WorkspaceContext } from '@/lib/workspace';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);

  const ws = useQuery({
    queryKey: ['workspace', slug],
    queryFn: () => api.get<Workspace>(`/workspaces/by-slug/${slug}`),
    enabled: Boolean(user),
  });

  useEffect(() => {
    if (ws.data) rememberWorkspace(ws.data.slug);
  }, [ws.data]);

  if (!user || ws.isPending) return <Spinner />;
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

  return (
    <WorkspaceContext.Provider value={ws.data}>
      <WorkspaceShell>{children}</WorkspaceShell>
      <CommandPalette />
      <CoachMarks />
    </WorkspaceContext.Provider>
  );
}
