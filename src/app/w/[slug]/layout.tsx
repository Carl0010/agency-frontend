'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BillingBanners, TrialPill } from '@/components/billing/billing-notices';
import { NotificationBell, PushExplainer } from '@/components/notifications';
import { SetupChip } from '@/components/onboarding/setup-chip';
import { CoachMarks } from '@/components/onboarding/tour';
import { CommandPalette, OPEN_EVENT } from '@/components/search/command-palette';
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
    { href: `/w/${slug}/settings/notifications`, label: 'Notifications' },
    // Admins and members never see the billing route (§8.6).
    ...(ws.data.role === 'owner' ? [{ href: `/w/${slug}/settings/billing`, label: 'Billing' }] : []),
  ];
  return (
    <WorkspaceContext.Provider value={ws.data}>
      <div className="flex h-full flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur">
          <Link href={`/w/${slug}/projects`} className="tap flex items-center gap-2 truncate text-[15px] font-semibold tracking-tight text-slate-900">
            <span aria-hidden className="size-5 shrink-0 rounded-md bg-blue-600 shadow-sm" />
            {ws.data.name}
          </Link>
          <nav className="ml-2 flex gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`tap flex items-center rounded-lg px-2.5 py-1 transition-colors ${pathname.startsWith(n.href) ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SetupChip ws={ws.data} />
            <TrialPill ws={ws.data} />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
              className="tap hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-white sm:flex"
            >
              Search <kbd className="rounded bg-white px-1 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200">⌘K</kbd>
            </button>
            <NotificationBell />
            <Avatar person={{ ...user, active: true }} size={30} />
            <button type="button" className="tap px-2 text-sm text-slate-600 hover:text-slate-900" onClick={() => void signOut().then(() => router.replace('/login'))}>
              Log out
            </button>
          </div>
        </header>
        <BillingBanners ws={ws.data} />
        <PushExplainer />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      <CommandPalette />
      <CoachMarks />
    </WorkspaceContext.Provider>
  );
}
