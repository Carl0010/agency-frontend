'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Avatar, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { Workspace } from '@/lib/types';
import { WorkspaceContext } from '@/lib/workspace';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();

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
        <Link className="text-blue-700" href="/">
          Go home
        </Link>
      </main>
    );
  }

  const nav = [
    { href: `/w/${slug}/projects`, label: 'Projects' },
    { href: `/w/${slug}/settings/members`, label: 'Members' },
  ];
  return (
    <WorkspaceContext.Provider value={ws.data}>
      <div className="flex h-full flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
          <Link href={`/w/${slug}/projects`} className="tap flex items-center truncate font-bold text-blue-700">
            {ws.data.name}
          </Link>
          <nav className="ml-2 flex gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`tap flex items-center rounded px-2 ${pathname.startsWith(n.href) ? 'bg-slate-100 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Avatar person={{ ...user, active: true }} size={28} />
            <button type="button" className="tap px-2 text-sm text-slate-600 hover:text-slate-900" onClick={() => void signOut().then(() => router.replace('/login'))}>
              Log out
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </WorkspaceContext.Provider>
  );
}
