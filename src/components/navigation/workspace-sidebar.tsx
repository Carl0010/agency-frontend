'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import Link from 'next/link';
import { useState } from 'react';
import { ProjectEditor } from '@/components/projects/project-editor';
import { ProjectMenu } from '@/components/projects/project-menu';
import { ProjectIcon } from '@/components/projects/project-icon';
import { ProjectStatusPill } from '@/components/projects/project-status';
import { OPEN_STATUSES, projectStatus } from '@/lib/project-status';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { SetupChip } from '@/components/onboarding/setup-chip';
import { TrialPill } from '@/components/billing/billing-notices';
import { Button } from '@/components/ui';
import type { Channel, Project, Team } from '@/lib/types';
import { orderByRecent, useRecentProjects } from '@/lib/recent-projects';
import { useWorkspace } from '@/lib/workspace';
import { AccountMenu } from '@/components/account-menu';
import { MODULE_LABELS, MY_WORK_PATH, PERSONAL_SETTINGS_PATH, TEAMS_PATH, type WorkspaceModule } from './workspace-modules';

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
  const router = useRouter();
  const pathname = usePathname();
  const base = `/w/${ws.id}`;
  // Admin console → Organization: the people and the teams of this workspace, and owner-only Billing.
  const organization: { path: string; label: string; icon: IconName }[] = [
    { path: '/settings/members', label: 'Members', icon: 'person' },
    { path: '/settings/teams', label: 'Teams', icon: 'people' },
    // Billing remains the owner's surface (§8.6).
    ...(ws.role === 'owner' ? [{ path: '/settings/billing', label: 'Billing', icon: 'credit-card' as const }] : []),
  ];

  // Your settings: the person's own choices. Profile and Language wait on the API (docs/handoffs/PERSONAL_SETTINGS.md).
  const personal: { path?: string; label: string; icon: IconName }[] = [
    { label: 'Profile', icon: 'person' },
    { path: '/me/notifications', label: 'Notifications', icon: 'bell' },
    { path: '/me/appearance', label: 'Appearance', icon: 'sun' },
    { label: 'Language', icon: 'globe' },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" data-testid="workspace-sidebar">
      <div className="flex min-h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href={`${base}/projects`} onClick={onNavigate} className="tap flex min-w-0 flex-1 items-center gap-2.5 rounded-md" aria-label={`${ws.name}, projects`}>
          <span className="min-w-0"><span className="block truncate text-label font-semibold">{ws.name}</span><span className="block text-caption text-muted-foreground">{MODULE_LABELS[activeModule]}</span></span>
        </Link>
        {onClose ? <Button variant="ghost" size="icon" aria-label="Close navigation" onClick={onClose}><Icon name="close" /></Button> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4">
        {activeModule === 'projects' ? <ProjectsNav data={data} projectId={projectId} base={base} pathname={pathname} onNavigate={onNavigate} onAdd={() => setCreating(true)} /> : null}
        {activeModule === 'teams' ? <TeamsNav teams={data.teams} pending={data.pending} base={base} pathname={pathname} onNavigate={onNavigate} /> : null}
        {activeModule === 'admin' ? <nav aria-label="Admin console" className="space-y-1">
          <p className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Organization</p>
          {organization.map((item) => <Link key={item.path} href={base + item.path} onClick={onNavigate} aria-current={pathname.startsWith(base + item.path) ? 'page' : undefined} className="ui-nav-link tap"><Icon name={item.icon} />{item.label}</Link>)}
        </nav> : null}
        {activeModule === 'my-work' ? <nav aria-label="My work navigation" className="space-y-1">
          <Link href={base + MY_WORK_PATH} onClick={onNavigate} aria-current="page" className="ui-nav-link tap"><Icon name="check" />Assigned to me</Link>
          <p className="px-2.5 pt-4 text-caption leading-5 text-muted-foreground">Cards assigned to you in every project you can see, by due date.</p>
        </nav> : null}
        {activeModule === 'inbox' ? <nav aria-label="Inbox navigation" className="space-y-1">
          <p className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Activity</p>
          <Link href={`${base}/inbox`} onClick={onNavigate} aria-current="page" className="ui-nav-link tap"><Icon name="inbox" />All notifications</Link>
          <Link href={base + PERSONAL_SETTINGS_PATH} onClick={onNavigate} className="ui-nav-link tap"><Icon name="settings" />Notification preferences</Link>
          <p className="px-2.5 pt-4 text-caption leading-5 text-muted-foreground">Mentions, assignments and project updates for this workspace.</p>
        </nav> : null}
        {activeModule === 'personal' ? <nav aria-label="Your settings" className="space-y-1">
          <p className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Your settings</p>
          {personal.map((item) => item.path
            ? <Link key={item.label} href={base + item.path} onClick={onNavigate} aria-current={pathname.startsWith(base + item.path) ? 'page' : undefined} className="ui-nav-link tap"><Icon name={item.icon} />{item.label}</Link>
            : <span key={item.label} aria-disabled="true" className="ui-nav-link cursor-default text-muted-foreground hover:bg-transparent"><Icon name={item.icon} />{item.label}<span className="ml-auto rounded-full bg-subtle px-2 py-0.5 text-caption">Soon</span></span>)}
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
        <AccountMenu subtitle={ws.role} settingsHref={base + PERSONAL_SETTINGS_PATH} onNavigate={onNavigate} />
      </div>
    </div>
  );
}


/**
 * The Projects module, like Asana's: your starred projects, then the rest by when you last opened
 * them in this browser. Only projects; a project's board and channels are tabs in its own header.
 */
function ProjectsNav({ data, projectId, base, pathname, onNavigate, onAdd }: { data: SidebarData; projectId?: string; base: string; pathname: string; onNavigate?: () => void; onAdd: () => void }) {
  const ws = useWorkspace();
  const recent = useRecentProjects(ws.id, projectId);
  const starredIds = new Set(data.starred.map((project) => project.id));
  const rest = orderByRecent(data.projects.filter((project) => !starredIds.has(project.id)), recent);
  const heading = 'mb-1.5 px-2.5 text-caption font-medium text-muted-foreground';
  return <nav aria-label="Projects" className="space-y-5">
    <div className="flex items-center justify-between gap-2">
      <Link href={`${base}/projects`} onClick={onNavigate} aria-current={pathname === `${base}/projects` ? 'page' : undefined} className="ui-nav-link tap min-w-0 flex-1"><Icon name="projects" /><span>Projects</span><span className="ml-auto text-caption text-muted-foreground">{data.pending ? '—' : data.projects.length}</span></Link>
      <Button variant="ghost" size="icon" aria-label="Add project" onClick={onAdd}><Icon name="plus" /></Button>
    </div>
    {data.pending ? <LoadingSkeleton label="Loading projects" count={3} className="px-2" /> : null}
    {data.error ? <div role="alert" className="space-y-2 rounded-md border border-danger-border bg-danger-subtle p-2.5 text-caption text-danger-text"><p>{data.error}</p><Button variant="secondary" size="sm" onClick={data.retry}>Try again</Button></div> : null}
    {!data.pending && !data.error && data.projects.length === 0 && data.starred.length === 0 ? <p className="px-2.5 text-caption text-muted-foreground">Projects shared with you will appear here.</p> : null}
    {data.starred.length ? <section aria-label="Starred"><h3 className={heading}>Starred</h3><ul className="space-y-0.5">{data.starred.map((project) => <SidebarProject key={project.id} project={project} data={data} currentId={projectId} showClosed onNavigate={onNavigate} />)}</ul></section> : null}
    {rest.length ? <section aria-label="Recent"><h3 className={heading}>Recent</h3><ul className="space-y-0.5">{rest.map((project) => <SidebarProject key={project.id} project={project} data={data} currentId={projectId} onNavigate={onNavigate} />)}</ul></section> : null}
  </nav>;
}

function SidebarProject({ project, data, currentId, showClosed = false, onNavigate }: { project: Project; data: SidebarData; currentId?: string; showClosed?: boolean; onNavigate?: () => void }) {
  const status = projectStatus(project.status).value;
  // In progress is the norm; mark the other open statuses, and closed ones where they can appear (Starred).
  const marked = status !== 'in_progress' && (showClosed || OPEN_STATUSES.includes(status));
  const ws = useWorkspace();
  const current = project.id === currentId;
  return <li>
    <div className="flex items-center gap-1"><Link href={`/w/${ws.id}/p/${project.id}/b/${project.defaultBoardId}`} onClick={onNavigate} aria-current={current ? 'location' : undefined} data-testid="rail-project" className={`ui-nav-link tap min-w-0 flex-1 ${current ? 'bg-subtle font-medium text-foreground' : ''}`}><ProjectIcon project={project} /><span className="min-w-0 flex-1 truncate">{project.name}</span>{marked ? <ProjectStatusPill project={project} className="px-1.5" /> : null}{data.channels.some((channel) => channel.projectId === project.id && channel.unreadCount > 0) ? <UnreadDot label={`Unread messages in ${project.name}`} /> : null}</Link><ProjectMenu project={project} onNavigate={onNavigate} /></div>
  </li>;
}

/** The Teams module lists teams only: yours first, then the rest of the workspace's active teams. */
function TeamsNav({ teams, pending, base, pathname, onNavigate }: { teams: Team[]; pending: boolean; base: string; pathname: string; onNavigate?: () => void }) {
  const active = teams.filter((team) => !team.archivedAt);
  const mine = active.filter((team) => team.myRole !== null);
  const others = active.filter((team) => team.myRole === null);
  const root = base + TEAMS_PATH;
  const link = (team: Team) => <li key={team.id}><Link href={`${root}/${team.id}`} onClick={onNavigate} aria-current={pathname === `${root}/${team.id}` ? 'page' : undefined} className="ui-nav-link tap"><span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-md bg-primary-subtle text-caption font-semibold text-primary-text">{team.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1 truncate">{team.name}</span></Link></li>;
  return <nav aria-label="Teams" className="space-y-1">
    <Link href={root} onClick={onNavigate} aria-current={pathname === root ? 'page' : undefined} className="ui-nav-link tap"><Icon name="people" /><span>All teams</span><span className="ml-auto text-caption text-muted-foreground">{pending ? '—' : active.length}</span></Link>
    {pending ? <LoadingSkeleton label="Loading teams" count={3} className="px-2" /> : null}
    {mine.length ? <section aria-label="Your teams" className="pt-5"><h3 className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Your teams</h3><ul className="space-y-1">{mine.map(link)}</ul></section> : null}
    {others.length ? <section aria-label="Other teams" className="pt-5"><h3 className="mb-2 px-2.5 text-caption font-medium text-muted-foreground">Other teams</h3><ul className="space-y-1">{others.map(link)}</ul></section> : null}
  </nav>;
}
