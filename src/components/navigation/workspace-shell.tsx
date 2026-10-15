'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BillingBanners } from '@/components/billing/billing-notices';
import { Icon } from '@/components/icon';
import { PushExplainer } from '@/components/notifications';
import { OPEN_EVENT } from '@/components/search/command-palette';
import { Button } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Page, Project } from '@/lib/types';
import { useWorkspaceChannels } from '@/lib/unread';
import { useWorkspace } from '@/lib/workspace';
import { NavigationDrawer } from './navigation-drawer';
import { WorkspaceSidebar, type SidebarData } from './workspace-sidebar';

/** One workspace sidebar for all member routes; never imported by the guest portal. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  const pathname = usePathname();
  const { projectId } = useParams<{ projectId?: string }>();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const projects = useQuery({ queryKey: ['projects', ws.id], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`) });
  // One subscription owner: mounting mobile navigation must not double-count live activity.
  const unread = useWorkspaceChannels();
  useEffect(() => { close(); }, [pathname, close]);

  const data: SidebarData = {
    projects: projects.data?.data ?? [], pending: projects.isPending,
    error: projects.error ? errorMessage(projects.error) : null,
    retry: () => { void projects.refetch(); }, channels: unread.channels,
  };
  const currentProject = data.projects.find((project) => project.id === projectId);
  const section = pathname.split(`/w/${ws.slug}/`)[1] ?? '';
  const title = projectId ? currentProject?.name ?? 'Project' :
    section.startsWith('settings/members') ? 'Members' :
    section.startsWith('settings/notifications') ? 'Notification preferences' :
    section.startsWith('settings/billing') ? 'Billing' :
    section.startsWith('inbox') ? 'Inbox' : section.startsWith('import') ? 'Import' : section.startsWith('search') ? 'Search' : 'Projects';

  const search = () => {
    close();
    // Let the native navigation modal leave the top layer before opening search.
    requestAnimationFrame(() => window.dispatchEvent(new Event(OPEN_EVENT)));
  };

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden">
      <a href="#workspace-content" className="sr-only z-50 rounded-md bg-surface p-3 text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <aside aria-label="Workspace sidebar" className="hidden w-64 shrink-0 border-r border-border bg-background lg:block">
        <WorkspaceSidebar data={data} projectId={projectId} onSearch={search} />
      </aside>
      {open ? <NavigationDrawer onClose={close}><WorkspaceSidebar data={data} projectId={projectId} onNavigate={close} onClose={close} onSearch={search} /></NavigationDrawer> : null}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header data-testid="workspace-header" className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-3 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" aria-expanded={open} aria-haspopup="dialog" data-tour={projectId ? 'client-channel' : undefined} onClick={() => setOpen(true)}><Icon name="menu" /></Button>
          <span className="hidden text-label text-muted-foreground sm:inline">Workspace</span>
          <Icon name="chevron" className="hidden size-3.5 text-muted-foreground sm:inline" />
          <p className="truncate text-label font-medium">{title}</p>
          <span className="ml-auto truncate text-caption text-muted-foreground lg:hidden">{ws.name}</span>
        </header>
        <BillingBanners ws={ws} />
        <PushExplainer />
        <div id="workspace-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">{children}</div>
      </div>
    </div>
  );
}
