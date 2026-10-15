'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, usePathname } from 'next/navigation';
import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react';
import { BillingBanners } from '@/components/billing/billing-notices';
import Link from 'next/link';
import { BrandMark, Icon } from '@/components/icon';
import { PushExplainer } from '@/components/notifications';
import { OPEN_EVENT } from '@/components/search/command-palette';
import { Button } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project } from '@/lib/types';
import { useWorkspaceChannels } from '@/lib/unread';
import { useWorkspace } from '@/lib/workspace';
import { ModuleRail } from './module-rail';
import { ThemeToggle } from './theme-toggle';
import { workspaceModule } from './workspace-modules';
import { NavigationDrawer } from './navigation-drawer';
import { WorkspaceSidebar, type SidebarData } from './workspace-sidebar';

/** Module rail and contextual sidebar for all member routes; never imported by the guest portal. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  const pathname = usePathname();
  const activeModule = workspaceModule(pathname, `/w/${ws.slug}`);
  const { projectId } = useParams<{ projectId?: string }>();
  const [open, setOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const close = useCallback(() => setOpen(false), []);
  const projects = useQuery({ queryKey: ['projects', ws.id], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`) });
  // One subscription owner: mounting mobile navigation must not double-count live activity.
  const unread = useWorkspaceChannels();
  // Clear the old route's drawer before paint so a quick reopen belongs to the new route.
  useLayoutEffect(() => { close(); }, [pathname, close]);

  const data: SidebarData = {
    projects: projects.data?.data ?? [], pending: projects.isPending,
    error: projects.error ? errorMessage(projects.error) : null,
    retry: () => { void projects.refetch(); }, channels: unread.channels,
  };
  const search = () => {
    close();
    // Let the native navigation modal leave the top layer before opening search.
    requestAnimationFrame(() => window.dispatchEvent(new Event(OPEN_EVENT)));
  };

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden">
      <a href="#workspace-content" className="sr-only z-50 rounded-md bg-surface p-3 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <header aria-label="Application bar" data-testid="workspace-header" className="grid h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-surface px-3 sm:gap-4 sm:px-5 lg:grid-cols-[1fr_minmax(20rem,36rem)_1fr]">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" aria-expanded={open} aria-haspopup="dialog" data-tour={projectId ? 'client-channel' : undefined} onClick={() => setOpen(true)}><Icon name="menu" className="size-5" /></Button>
          <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={sidebarVisible ? 'Close sidebar' : 'Open sidebar'} aria-expanded={sidebarVisible} aria-controls="desktop-sidebar" onClick={() => setSidebarVisible((visible) => !visible)}><Icon name="menu" className="size-5" /></Button>
          <Link href={`/w/${ws.slug}/projects`} aria-label="Agency home" className="hidden min-w-0 items-center gap-2.5 rounded-md sm:flex"><BrandMark /><span className="truncate text-body font-semibold">Agency</span></Link>
        </div>
        <button type="button" aria-label="Search workspace" onClick={search} className="tap flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-label text-muted-foreground hover:border-input hover:bg-subtle">
          <Icon name="search" /><span className="truncate">Search<span className="hidden sm:inline"> cards, comments and messages</span></span><kbd className="ml-auto hidden shrink-0 rounded border border-border bg-surface px-1.5 text-caption sm:inline">⌘ / Ctrl K</kbd>
        </button>
        <div className="justify-self-end"><ThemeToggle /></div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside aria-label="Module rail" className="hidden w-[72px] shrink-0 border-r border-border bg-surface lg:block">
          <ModuleRail activeModule={activeModule} />
        </aside>
        <aside id="desktop-sidebar" aria-label="Workspace sidebar" className={`${sidebarVisible ? 'hidden lg:block' : 'hidden'} w-64 shrink-0 border-r border-border bg-background`}>
          <WorkspaceSidebar data={data} projectId={projectId} activeModule={activeModule} />
        </aside>
        {open ? <NavigationDrawer onClose={close}>
          <div className="flex h-full min-w-0">
            <div className="w-[72px] shrink-0 border-r border-border bg-surface"><ModuleRail activeModule={activeModule} onNavigate={close} /></div>
            <div className="min-w-0 flex-1"><WorkspaceSidebar data={data} projectId={projectId} activeModule={activeModule} onNavigate={close} onClose={close} /></div>
          </div>
        </NavigationDrawer> : null}
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <BillingBanners ws={ws} />
          <PushExplainer />
          <div id="workspace-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">{children}</div>
        </div>
      </div>
    </div>
  );
}
