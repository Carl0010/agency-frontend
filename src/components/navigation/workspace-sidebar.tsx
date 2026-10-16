'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProjectEditor } from '@/components/projects/project-editor';
import { ProjectMenu } from '@/components/projects/project-menu';
import { ProjectIcon } from '@/components/projects/project-icon';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { SetupChip } from '@/components/onboarding/setup-chip';
import { TrialPill } from '@/components/billing/billing-notices';
import { Avatar, Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Channel, Project, Team } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { MODULE_LABELS, type WorkspaceModule } from './workspace-modules';

function UnreadDot({ label }: { label: string }) {
  return <span role="img" aria-label={label} data-testid="unread-dot" className="inline-block size-2 shrink-0 rounded-full bg-primary" />;
}

export interface SidebarData {
  projects: Project[];
  teams: Team[];
  starred: Project[];
  pending: boolean;
  error: string | null;
  retry: () => void;
  channels: Channel[];
}

/** Module destinations, project management and account controls; board actions stay with the board. */
export function WorkspaceSidebar({ data, projectId, activeModule, onNavigate, onClose }: {
  data: SidebarData;
  activeModule: WorkspaceModule;
  projectId?: string;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const ws = useWorkspace();
  const [creating, setCreating] = useState(false);
  const { user, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const base = `/w/${ws.slug}`;
  const settings: { path: string; label: string; icon: IconName }[] = [
    { path: '/settings/members', label: 'Members', icon: 'people' },
    { path: '/settings/teams', label: 'Teams', icon: 'people' },
    { path: '/settings/notifications', label: 'Notifications', icon: 'settings' },
    // Billing remains the owner's surface (§8.6).
    ...(ws.role === 'owner' ? [{ path: '/settings/billing', label: 'Billing', icon: 'credit-card' as const }] : []),
  ];

  async function logout() {
    try {
      await signOut();
      onNavigate?.();
      router.replace('/login');
    } catch (error) { toast(errorMessage(error)); }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-testid="workspace-sidebar">
      <div className="flex min-h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href={`${base}/projects`} onClick={onNavigate} className="tap flex min-w-0 flex-1 items-center gap-2.5 rounded-md" aria-label={`${ws.name}, projects`}>
          <span className="min-w-0"><span className="block truncate text-label font-semibold">{ws.name}</span><span className="block text-caption text-muted-foreground">{MODULE_LABELS[activeModule]}</span></span>
        </Link>
        {onClose ? <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={onClose}><Icon name="close" /></Button> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4">
        {activeModule === 'projects' ? <>
          <nav aria-label="Project navigation" className="space-y-1">
            <Link href={`${base}/projects`} onClick={onNavigate} aria-current={pathname === `${base}/projects` ? 'page' : undefined} className="ui-nav-link tap">
              <Icon name="projects" /><span>Projects</span><span className="ml-auto text-caption text-muted-foreground">{data.pending ? '—' : data.projects.length}</span>
            </Link>
            <Link href={`${base}/import`} onClick={onNavigate} aria-current={pathname.startsWith(`${base}/import`) ? 'page' : undefined} className="ui-nav-link tap"><Icon name="import" />Import</Link>
          </nav>

          <nav aria-label="Projects" className="mt-6">
            <div className="mb-2 flex items-center justify-between px-2.5 text-caption font-medium text-muted-foreground"><span>Projects</span><Button variant="ghost" size="icon" aria-label="Add project" onClick={() => setCreating(true)}><Icon name="plus" /></Button></div>
            {data.pending ? <p role="status" className="px-2.5 py-2 text-caption text-muted-foreground">Loading projects…</p> : null}
            {data.error ? <div role="alert" className="space-y-2 rounded-md border border-danger-border bg-danger-subtle p-2.5 text-caption text-danger-text"><p>{data.error}</p><Button variant="secondary" size="sm" onClick={data.retry}>Try again</Button></div> : null}
            {!data.pending && !data.error && data.projects.length === 0 ? <p className="px-2.5 py-2 text-caption text-muted-foreground">Projects shared with you will appear here.</p> : null}
            {data.starred.length ? <section aria-label="Starred" className="mb-5"><h3 className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Starred</h3><ul className="space-y-1">{data.starred.map((project) => <SidebarProject key={project.id} project={project} data={data} currentId={projectId} expanded={false} onNavigate={onNavigate} />)}</ul></section> : null}
            {data.teams.map((team) => {
              const projects = data.projects.filter((project) => project.teamIds?.includes(team.id));
              if (!projects.length) return null;
              return <section key={team.id} aria-label={`${team.name} projects`} className="mb-5"><h3 className="mb-2 px-2.5 text-caption font-medium text-muted-foreground"><Link href={`${base}/projects?team=${encodeURIComponent(team.id)}`} onClick={onNavigate} className="tap block truncate rounded-md hover:text-foreground">{team.name}</Link></h3><ul className="space-y-1">{projects.map((project) => <SidebarProject key={project.id} project={project} data={data} currentId={projectId} expanded={data.teams.find((item) => project.teamIds?.includes(item.id))?.id === team.id} onNavigate={onNavigate} />)}</ul></section>;
            })}
            {data.projects.some((project) => !data.teams.some((team) => project.teamIds?.includes(team.id))) ? <section aria-label="Other projects"><h3 className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Other projects</h3><ul className="space-y-1">{data.projects.filter((project) => !data.teams.some((team) => project.teamIds?.includes(team.id))).map((project) => <SidebarProject key={project.id} project={project} data={data} currentId={projectId} expanded onNavigate={onNavigate} />)}</ul></section> : null}
          </nav>

        </> : null}
        {activeModule === 'workspace' ? <nav aria-label="Workspace settings" className="space-y-1">
          <p className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Workspace</p>
          {settings.map((item) => <Link key={item.path} href={base + item.path} onClick={onNavigate} aria-current={pathname.startsWith(base + item.path) ? 'page' : undefined} className="ui-nav-link tap"><Icon name={item.icon} />{item.label}</Link>)}
        </nav> : null}
        {activeModule === 'inbox' ? <nav aria-label="Inbox navigation" className="space-y-1">
          <p className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Activity</p>
          <Link href={`${base}/inbox`} onClick={onNavigate} aria-current="page" className="ui-nav-link tap"><Icon name="inbox" />All notifications</Link>
          <Link href={`${base}/settings/notifications`} onClick={onNavigate} className="ui-nav-link tap"><Icon name="settings" />Notification preferences</Link>
          <p className="px-2.5 pt-4 text-caption leading-5 text-muted-foreground">Mentions, assignments and project updates for this workspace.</p>
        </nav> : null}
      </div>

      {creating ? <ProjectEditor onClose={() => setCreating(false)} onSaved={(project) => {
        setCreating(false);
        onNavigate?.();
        router.push(`${base}/p/${project.id}/b/${project.defaultBoardId}`);
      }} /> : null}
      <div className="shrink-0 space-y-2 border-t border-border p-3">
        <SetupChip ws={ws} onNavigate={onNavigate} />
        <TrialPill ws={ws} onNavigate={onNavigate} />
        {user ? <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
          <Avatar person={{ ...user, active: true }} size={30} />
          <div className="min-w-0 flex-1"><p className="truncate text-label font-medium">{user.name}</p><p className="text-caption capitalize text-muted-foreground">{ws.role}</p></div>
          <Button variant="ghost" size="icon" aria-label="Log out" title="Log out" onClick={() => void logout()}><Icon name="logout" /></Button>
        </div> : null}
      </div>
    </div>
  );
}


function SidebarProject({ project, data, currentId, expanded, onNavigate }: { project: Project; data: SidebarData; currentId?: string; expanded: boolean; onNavigate?: () => void }) {
  const ws = useWorkspace(); const pathname = usePathname();
  const current = project.id === currentId;
  const projectBase = `/w/${ws.slug}/p/${project.id}`;
  const sections: { label: string; path: string; icon: IconName; kind?: 'shared' | 'internal' }[] = [
    { label: 'Board', path: `/b/${project.defaultBoardId}`, icon: 'board' },
    { label: 'Shared', path: '/chat', icon: 'comment', kind: 'shared' },
    { label: 'Team', path: '/team', icon: 'lock', kind: 'internal' },
  ];
  return <li>
    <div className="flex items-center gap-1"><Link href={`${projectBase}/b/${project.defaultBoardId}`} onClick={onNavigate} aria-current={current ? 'location' : undefined} data-testid="rail-project" className={`ui-nav-link tap min-w-0 flex-1 ${current ? 'bg-subtle font-medium text-foreground' : ''}`}><ProjectIcon project={project} /><span className="min-w-0 flex-1 truncate">{project.name}</span>{data.channels.some((channel) => channel.projectId === project.id && channel.unreadCount > 0) ? <UnreadDot label={`Unread messages in ${project.name}`} /> : null}</Link><ProjectMenu project={project} onNavigate={onNavigate} /></div>
    {current && expanded ? <ul aria-label="Project sections" className="my-1 ml-3 border-l border-border pl-3">{sections.map((section) => {
      const selected = section.kind ? pathname.startsWith(projectBase + section.path) : pathname.startsWith(`${projectBase}/b/`);
      const unread = section.kind && !selected && data.channels.some((channel) => channel.projectId === project.id && channel.kind === section.kind && channel.unreadCount > 0);
      return <li key={section.label}><Link href={projectBase + section.path} onClick={onNavigate} aria-current={selected ? 'page' : undefined} data-tour={section.kind === 'shared' ? 'shared-channel' : undefined} className="ui-nav-link tap"><Icon name={section.icon} className="size-3.5" /><span>{section.label}</span>{section.kind === 'internal' ? <span data-testid="internal-badge" className="ml-auto rounded-sm bg-muted px-1 text-caption text-muted-foreground">Internal</span> : null}{unread ? <UnreadDot label={`Unread in ${section.label}`} /> : null}</Link></li>;
    })}</ul> : null}
  </li>;
}
