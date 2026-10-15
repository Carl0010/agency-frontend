'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Avatar, GuestChip, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { PortalContext, portalProjectsKey } from '@/lib/portal';
import { useSession } from '@/lib/session';
import type { Page, PortalProject, Workspace } from '@/lib/types';
import { WorkspaceContext } from '@/lib/workspace';

/**
 * Guest view header (§3.6): the agency's name, the project, a `Guest` chip
 * with the access level, a switcher listing only granted projects (AC13),
 * and exactly two tabs — Board and Chat.
 */
export default function PortalProjectLayout({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();
  const projects = useQuery({ queryKey: portalProjectsKey, queryFn: () => api.get<Page<PortalProject>>('/portal/projects') });
  const project = projects.data?.data.find((p) => p.id === projectId.toLowerCase());
  // The guest's own, redacted view of the workspace (no plan, no setup state).
  const ws = useQuery({
    queryKey: ['workspace-by-id', project?.workspaceId],
    queryFn: () => api.get<Workspace>(`/workspaces/${project?.workspaceId}`),
    enabled: Boolean(project),
  });

  if (projects.isPending) return <Spinner />;
  if (!project) {
    return (
      <main className="mx-auto max-w-md p-8 text-center" data-testid="portal-not-found">
        <h1 className="text-lg font-semibold">Project not found</h1>
        <p className="mt-2 text-sm text-secondary-foreground">It does not exist, or it is no longer shared with you.</p>
        <Link className="mt-4 inline-block text-sm text-primary" href="/portal">
          Your projects
        </Link>
      </main>
    );
  }
  if (ws.isPending || !ws.data) return <Spinner />;

  const base = `/portal/${project.id}`;
  const tabs = [
    { href: base, label: 'Board', current: pathname === base || pathname.startsWith(`${base}/c/`) },
    { href: `${base}/chat`, label: 'Chat', current: pathname.startsWith(`${base}/chat`) },
  ];
  const others = projects.data?.data ?? [];

  return (
    <WorkspaceContext.Provider value={ws.data}>
      <PortalContext.Provider value={{ project, projects: others }}>
        <div className="flex h-full flex-col" data-testid="portal-layout">
          <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-surface px-3 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-inverse text-xs font-bold text-inverse-foreground" aria-hidden>
              {project.workspaceName.slice(0, 1).toUpperCase()}
            </span>
            <span className="text-sm font-semibold text-secondary-foreground" data-testid="portal-agency">
              {project.workspaceName}
            </span>
            <span className="text-muted-foreground">/</span>
            <div className="min-w-0">
              <h1 className="truncate font-semibold">{project.name}</h1>
              {project.clientName ? <p className="truncate text-xs text-muted-foreground">{project.clientName}</p> : null}
            </div>
            <GuestChip access={project.access} />
            {others.length > 1 ? (
              <label className="flex items-center gap-1 text-sm text-secondary-foreground">
                <span className="sr-only">Switch project</span>
                <select
                  data-testid="portal-switcher"
                  className="tap rounded-md border border-input bg-surface px-2 text-sm"
                  value={project.id}
                  onChange={(e) => router.push(`/portal/${e.target.value}`)}
                >
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {others.some((o) => o.workspaceId !== p.workspaceId) ? `${p.workspaceName} — ${p.name}` : p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <nav className="flex gap-1 text-sm" aria-label="Project sections">
              {tabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={t.current ? 'page' : undefined}
                  className={`tap flex items-center rounded px-2 ${t.current ? 'bg-subtle font-medium' : 'text-secondary-foreground hover:bg-background'}`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {user ? <Avatar person={{ ...user, active: true }} size={28} /> : null}
              <button type="button" className="tap px-2 text-sm text-secondary-foreground hover:text-foreground" onClick={() => void signOut().then(() => router.replace('/login'))}>
                Log out
              </button>
            </div>
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </PortalContext.Provider>
    </WorkspaceContext.Provider>
  );
}
