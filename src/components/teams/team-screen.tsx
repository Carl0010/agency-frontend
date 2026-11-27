'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { FormError } from '@/components/auth-card';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { useConfirm } from '@/components/confirmation';
import { Icon } from '@/components/icon';
import { ProjectIcon } from '@/components/projects/project-icon';
import { ProjectStatusPill } from '@/components/projects/project-status';
import { LoadingSkeleton } from '@/components/skeleton';
import { Avatar, Badge, Button, EmptyState, Field, Input, Select } from '@/components/ui';
import { Dialog, DialogActions } from '@/components/ui-dialog';
import { GUEST_ACCESS, TEAM_ROLES } from '@/lib/access-options';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formText } from '@/lib/form';
import { useSession } from '@/lib/session';
import type { Member, Page, Project, TeamDetail, TeamMember } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { PersonAvatar, useRoster } from '@/components/people/person-card';
import { useTeamWrite } from './teams-screen';

type Tab = 'overview' | 'members' | 'settings';
export type TeamSection = 'teams' | 'admin';

/** The team list a team page belongs to. */
export function teamsListPath(workspaceId: string, section: TeamSection) {
  return section === 'admin' ? `/w/${workspaceId}/settings/teams` : `/w/${workspaceId}/teams`;
}
type Write = ReturnType<typeof useTeamWrite>;

/**
 * One team, in tabs kept in the URL (`?tab=`): Overview (a cover, the team's projects and its
 * people), Members (grouped, with Add people and Invite guest), Team chat (not in the API yet, shown
 * as Soon), and Settings (name, archive) for the people who manage the team. The API enforces every
 * action; the UI only hides what can't work. `section` is the module it opens in: the Teams
 * directory (`/teams`) or Admin console → Teams (`/settings/teams`). Both show the same team; only
 * the tab URLs differ.
 */
export function TeamScreen({ teamId, section = 'teams' }: { teamId: string; section?: TeamSection }) {
  const ws = useWorkspace();
  const list = teamsListPath(ws.id, section);
  const { readOnly } = useWriteAvailability(ws);
  const params = useSearchParams();
  const team = useQuery({ queryKey: ['team', teamId], queryFn: ({ signal }) => api.get<TeamDetail>(`/teams/${teamId}`, signal) });
  const projects = useQuery({ queryKey: ['projects', ws.id, { team: teamId }], queryFn: ({ signal }) => api.get<Page<Project>>(`/workspaces/${ws.id}/projects?team=${teamId}`, signal) });
  const act = useTeamWrite(teamId);
  if (team.isPending) return <LoadingSkeleton variant="cards" className="p-4 sm:p-6" />;
  if (team.error) return <main className="ui-page"><h1 className="mb-2 text-page font-semibold">{team.error instanceof ApiError && team.error.code === 'not_found' ? 'Team unavailable' : 'Could not load team'}</h1><FormError message={errorMessage(team.error)} /><Button variant="secondary" onClick={() => void team.refetch()}>Retry team</Button></main>;

  const t = team.data; const archived = Boolean(t.archivedAt);
  const canManage = !readOnly && (ws.role === 'owner' || ws.role === 'admin' || t.myRole === 'admin');
  const requested = params.get('tab');
  // `?tab=projects` predates the Projects card on Overview; it lands there.
  const tab: Tab = requested === 'members' || (requested === 'settings' && canManage) ? requested : 'overview';
  const base = `${list}/${teamId}`;
  const href = (id: Tab) => id === 'overview' ? base : `${base}?tab=${id}`;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members', count: t.memberCount },
    ...(canManage ? [{ id: 'settings' as const, label: 'Settings' }] : []),
  ];

  return <main className="ui-page">
    <header className="mb-3 flex flex-wrap items-center gap-3">
      <Avatar person={{ id: t.id, name: t.name, avatarUrl: null }} size={36} plain />
      <h1 className="min-w-0 break-words text-page font-semibold">{t.name}</h1>
      {archived ? <Badge tone="warning">Archived</Badge> : null}
    </header>
    <nav aria-label="Team sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-border pb-2">
      {tabs.slice(0, 2).map((item) => <TabLink key={item.id} item={item} href={href(item.id)} current={tab === item.id} />)}
      <span aria-disabled="true" className="ui-tab shrink-0 cursor-default text-muted-foreground hover:bg-transparent">Team chat<span className="rounded-full bg-subtle px-2 py-0.5 text-caption">Soon</span></span>
      {tabs.slice(2).map((item) => <TabLink key={item.id} item={item} href={href(item.id)} current={tab === item.id} />)}
    </nav>
    {archived ? <p className="mb-5 rounded-lg border border-warning-border bg-warning-subtle p-3 text-label text-warning-text">This team is archived. Its people and project shares are paused until it’s restored{canManage ? ' in Settings' : ''}.</p> : null}
    <FormError message={act.error ? errorMessage(act.error) : null} />
    {tab === 'overview' ? <Overview team={t} projects={projects} canShare={!readOnly && !archived} membersHref={href('members')} /> : null}
    {tab === 'members' ? <Members team={t} canManage={canManage && !archived} act={act} /> : null}
    {tab === 'settings' ? <Settings team={t} act={act} /> : null}
  </main>;
}

function TabLink({ item, href, current }: { item: { label: string; count?: number }; href: string; current: boolean }) {
  return <Link href={href} scroll={false} aria-current={current ? 'page' : undefined} className="ui-tab shrink-0">
    {item.label}{item.count !== undefined ? <span className="rounded-full bg-subtle px-1.5 text-caption text-muted-foreground">{item.count}</span> : null}
  </Link>;
}

/** A cover with the team's mark and name, then its projects beside its people. */
function Overview({ team, projects, canShare, membersHref }: { team: TeamDetail; projects: ReturnType<typeof useQuery<Page<Project>>>; canShare: boolean; membersHref: string }) {
  const { byId } = useRoster();
  const count = projects.data?.data.length;
  return <div>
    <div aria-hidden="true" className="relative mb-14 h-28 rounded-2xl bg-primary-subtle sm:h-36">
      <span className="absolute -bottom-12 left-6 flex rounded-full ring-4 ring-background sm:left-10"><Avatar person={{ id: team.id, name: team.name, avatarUrl: null }} size={96} plain /></span>
    </div>
    <div className="mb-6 px-1 sm:px-4">
      <p aria-hidden="true" className="break-words text-2xl font-semibold">{team.name}</p>
      <p className="text-label text-muted-foreground">{team.memberCount} {team.memberCount === 1 ? 'person' : 'people'}{count !== undefined ? ` · ${count} ${count === 1 ? 'project' : 'projects'}` : ''}</p>
    </div>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Projects team={team} projects={projects} canShare={canShare} />
      <section aria-labelledby="team-members-card" className="ui-panel p-4">
        <div className="mb-3 flex items-center gap-2"><h2 id="team-members-card" className="flex-1 font-semibold">Members</h2><Link href={membersHref} scroll={false} className="tap inline-flex items-center rounded-md px-1 text-label text-primary">View all {team.memberCount}</Link></div>
        {team.members.length ? <ul aria-label={`People in ${team.name}`} className="flex flex-wrap gap-2">
          {team.members.map((member) => <li key={member.userId} className="flex"><PersonAvatar person={member} email={byId.get(member.userId)?.email} size={36} /></li>)}
        </ul> : <p className="text-label text-muted-foreground">No one in this team yet.</p>}
      </section>
    </div>
  </div>;
}

/** People, grouped: team admins, members, guests. Managers add people and invite guests here. */
function Members({ team, canManage, act }: { team: TeamDetail; canManage: boolean; act: Write }) {
  const [dialog, setDialog] = useState<'add' | 'guest' | null>(null);
  const admins = team.members.filter((member) => !member.guest && member.role === 'admin');
  const members = team.members.filter((member) => !member.guest && member.role !== 'admin');
  const guests = team.members.filter((member) => member.guest);
  const invited = team.members.filter((member) => member.status === 'invited').length;
  return <div className="space-y-5">
    <section className="ui-panel" aria-labelledby="team-people">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1"><h2 id="team-people" className="font-semibold">People</h2><p className="text-caption text-muted-foreground">{team.memberCount} in this team{invited ? ` · ${invited} invited` : ''}</p></div>
        {canManage ? <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" onClick={() => setDialog('guest')}><Icon name="mail" />Invite guest</Button>
          <Button onClick={() => setDialog('add')}><Icon name="plus" />Add people</Button>
        </div> : null}
      </header>
      <div className="divide-y divide-border">
        <PeopleGroup title="Team admins" hint="Manage people and the team’s projects." people={admins} team={team} canManage={canManage} act={act} />
        <PeopleGroup title="Members" hint="See every project shared with the team." people={members} team={team} canManage={canManage} act={act} />
        <PeopleGroup title="Guests" hint="From outside the workspace. They see shared projects at their access level and never use a seat." people={guests} team={team} canManage={canManage} act={act}
          empty={canManage ? <Button variant="ghost" onClick={() => setDialog('guest')}>Invite a guest</Button> : 'No guests in this team.'} />
      </div>
    </section>
    {dialog === 'add' ? <AddPeopleDialog team={team} act={act} onClose={() => setDialog(null)} /> : null}
    {dialog === 'guest' ? <InviteGuestDialog team={team} act={act} onClose={() => setDialog(null)} /> : null}
  </div>;
}

function PeopleGroup({ title, hint, people, team, canManage, act, empty }: { title: string; hint: string; people: TeamMember[]; team: TeamDetail; canManage: boolean; act: Write; empty?: ReactNode }) {
  const { user } = useSession(); const confirm = useConfirm(); const { byId } = useRoster();
  const { readOnly } = useWriteAvailability(useWorkspace());
  const adminCount = team.members.filter((member) => !member.guest && member.role === 'admin').length;
  if (!people.length && !empty) return null;
  return <div className="px-4 py-3" role="group" aria-label={title}>
    <h3 className="text-label font-semibold">{title} <span className="font-normal text-muted-foreground">{people.length}</span></h3>
    <p className="mb-1 text-caption text-muted-foreground">{hint}</p>
    {people.length ? <ul>{people.map((member) => {
      const lastAdmin = !member.guest && member.role === 'admin' && adminCount === 1;
      const self = member.userId === user?.id;
      return <li key={member.userId} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3" data-testid="team-member-row">
        <div className="flex min-w-0 flex-1 items-center gap-3" data-testid="team-member-identity"><Avatar person={{ id: member.userId, ...member }} size={32} /><div className="min-w-0 flex-1">
          <p className="break-words text-label font-medium">{member.name}{self ? ' (you)' : ''}</p>
          {byId.get(member.userId)?.email ? <p className="break-all text-caption text-muted-foreground">{byId.get(member.userId)?.email}</p> : null}
          <p className="text-caption text-muted-foreground">{member.guest ? 'Guest' : member.role === 'admin' ? 'Team admin' : 'Team member'}{member.status === 'invited' ? ' · invited' : ''}{lastAdmin ? ' · Last admin' : ''}</p>
        </div></div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0" data-testid="team-member-controls">
          {canManage && !lastAdmin ? <Select aria-label={`${member.guest ? 'Guest access' : 'Team role'} for ${member.name}`} value={member.guest ? member.access ?? 'comment' : member.role} disabled={act.isPending} className="w-36"
            options={member.guest ? GUEST_ACCESS : TEAM_ROLES}
            onChange={(value) => act.mutate(() => api.put(`/teams/${team.id}/members/${member.userId}`, member.guest ? { access: value } : { role: value }))} />
            : member.guest ? <Badge>{member.access === 'comment' ? 'Can comment' : 'Can view'}</Badge> : null}
          {!readOnly && !team.archivedAt && !lastAdmin && (canManage || self) ? <Button variant="ghost" disabled={act.isPending} aria-label={self ? 'Leave team' : `Remove ${member.name}`} onClick={async () => {
            if (await confirm({ title: self ? 'Leave team?' : 'Remove person from team?', description: 'Access through this team will end. Other project grants and shared teams remain. A guest loses workspace membership if this was their last team or project.', confirmLabel: self ? 'Leave team' : 'Remove person' })) act.mutate(() => api.del(`/teams/${team.id}/members/${member.userId}`));
          }}>{self ? 'Leave' : 'Remove'}</Button> : null}
        </div>
      </li>;
    })}</ul> : <div className="py-2 text-label text-muted-foreground">{empty}</div>}
  </div>;
}

function AddPeopleDialog({ team, act, onClose }: { team: TeamDetail; act: Write; onClose: () => void }) {
  const ws = useWorkspace(); const [personId, setPersonId] = useState('');
  const roster = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });
  const inTeam = new Set(team.members.map((member) => member.userId));
  const available = (roster.data?.data ?? []).filter((member) => member.status !== 'deactivated' && !inTeam.has(member.userId));
  const selected = available.find((member) => member.userId === personId);
  return <Dialog title="Add people" onClose={onClose}>
    <p className="text-label text-muted-foreground">Add someone from {ws.name}. They’ll see every project shared with {team.name}.</p>
    <FormError message={roster.error ? errorMessage(roster.error) : act.error ? errorMessage(act.error) : null} />
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      act.mutate(() => api.put(`/teams/${team.id}/members/${personId}`, selected?.role === 'guest' ? { access: data.get('access') } : { role: data.get('role') }), { onSuccess: () => { setPersonId(''); onClose(); } });
    }}>
      <Field label="Person"><Select aria-label="Person to add" value={personId || null} required placeholder={roster.isPending ? 'Loading people…' : available.length ? 'Choose person' : 'Everyone is already in this team'} onChange={setPersonId} className="w-full"
        options={available.map((member) => ({ value: member.userId, label: `${member.name}${member.role === 'guest' ? ' (guest)' : ''}${member.status === 'invited' ? ' (invited)' : ''}` }))} /></Field>
      <Field label={selected?.role === 'guest' ? 'Guest access' : 'Team role'}>
        {selected?.role === 'guest' ? <Select key="access" name="access" aria-label="New team guest access" defaultValue="comment" className="w-full" options={GUEST_ACCESS} /> : <Select key="role" name="role" aria-label="New team role" defaultValue="member" className="w-full" options={TEAM_ROLES} />}
      </Field>
      <DialogActions><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={act.isPending || !selected}>Add person</Button></DialogActions>
    </form>
  </Dialog>;
}

function InviteGuestDialog({ team, act, onClose }: { team: TeamDetail; act: Write; onClose: () => void }) {
  const { invitesBlocked } = useWriteAvailability(useWorkspace());
  return <Dialog title="Invite a guest" onClose={onClose}>
    <p className="text-label text-muted-foreground">Guests see every project shared with {team.name} at the access you choose. They never use a seat or become team admins.</p>
    <FormError message={act.error ? errorMessage(act.error) : null} />
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      act.mutate(() => api.post(`/teams/${team.id}/guests`, { email: formText(data, 'email'), access: data.get('access') }), { onSuccess: onClose });
    }}>
      <Field label="Guest email"><Input name="email" type="email" required maxLength={254} placeholder="guest@example.com" data-autofocus /></Field>
      <Field label="Access"><Select name="access" aria-label="Team guest access" defaultValue="comment" className="w-full" options={GUEST_ACCESS} /></Field>
      <DialogActions><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={act.isPending || invitesBlocked}>Invite guest to team</Button></DialogActions>
    </form>
  </Dialog>;
}

function Projects({ team, projects, canShare }: { team: TeamDetail; projects: ReturnType<typeof useQuery<Page<Project>>>; canShare: boolean }) {
  const ws = useWorkspace(); const confirm = useConfirm(); const act = useTeamWrite(team.id);
  const [sharing, setSharing] = useState(false);
  if (projects.isPending) return <LoadingSkeleton variant="cards" />;
  if (projects.error) return <div role="alert" className="space-y-3"><p>{errorMessage(projects.error)}</p><Button variant="secondary" onClick={() => void projects.refetch()}>Retry projects</Button></div>;
  const list = projects.data.data;
  return <section aria-labelledby="team-projects" className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1"><h2 id="team-projects" className="font-semibold">Projects</h2><p className="text-caption text-muted-foreground">Everyone in the team sees these. Project admins share and unshare them.</p></div>
      {canShare && list.length ? <Button onClick={() => setSharing(true)}><Icon name="plus" />Share a project</Button> : null}
    </div>
    <FormError message={act.error ? errorMessage(act.error) : null} />
    {list.length ? <ul className="ui-panel divide-y divide-border">{list.map((project) => <li key={project.id} className="flex items-center gap-3 px-4 py-3" data-testid="team-project-row">
      <Link href={`/w/${ws.id}/p/${project.id}/b/${project.defaultBoardId}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md"><ProjectIcon project={project} /><span className="min-w-0"><span className="block truncate font-medium">{project.name}</span><span className="text-caption text-muted-foreground">{project.key}</span></span></Link>
      <ProjectStatusPill project={project} />
      {canShare && project.access === 'admin' ? <Button variant="ghost" disabled={act.isPending} aria-label={`Unshare ${project.name}`} onClick={async () => {
        if (await confirm({ title: `Unshare ${project.name}?`, description: `${team.name} loses access through this share. People keep any other way in they have.`, confirmLabel: 'Unshare project', tone: 'danger' })) act.mutate(() => api.del(`/projects/${project.id}/teams/${team.id}`));
      }}>Unshare</Button> : null}
    </li>)}</ul> : <EmptyState title="No projects yet" description={`Projects shared with ${team.name} appear here, and everyone in the team can open them.`} icon="board" action={canShare ? <Button onClick={() => setSharing(true)}><Icon name="plus" />Share a project</Button> : undefined} />}
    {sharing ? <ShareProjectDialog team={team} shared={new Set(list.map((project) => project.id))} act={act} onClose={() => setSharing(false)} /> : null}
  </section>;
}

function ShareProjectDialog({ team, shared, act, onClose }: { team: TeamDetail; shared: Set<string>; act: Write; onClose: () => void }) {
  const ws = useWorkspace(); const [projectId, setProjectId] = useState('');
  // Only project admins can share a project, so only offer theirs.
  const all = useQuery({ queryKey: ['projects', ws.id, { all: true }], queryFn: ({ signal }) => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`, signal) });
  const shareable = (all.data?.data ?? []).filter((project) => project.access === 'admin' && !shared.has(project.id));
  return <Dialog title="Share a project" onClose={onClose}>
    <p className="text-label text-muted-foreground">Everyone in {team.name} will see the project. You can share projects you’re an admin of.</p>
    <FormError message={all.error ? errorMessage(all.error) : act.error ? errorMessage(act.error) : null} />
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      act.mutate(() => api.put(`/projects/${projectId}/teams/${team.id}`), { onSuccess: onClose });
    }}>
      <Field label="Project"><Select aria-label="Project to share" value={projectId || null} required onChange={setProjectId} className="w-full"
        placeholder={all.isPending ? 'Loading projects…' : shareable.length ? 'Choose project' : 'No other projects you can share'}
        options={shareable.map((project) => ({ value: project.id, label: `${project.name} (${project.key})` }))} /></Field>
      <DialogActions><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={act.isPending || !projectId}>Share project</Button></DialogActions>
    </form>
  </Dialog>;
}

function Settings({ team, act }: { team: TeamDetail; act: Write }) {
  const confirm = useConfirm(); const archived = Boolean(team.archivedAt);
  return <div className="max-w-2xl space-y-5">
    {!archived ? <section className="ui-panel p-4" aria-labelledby="team-name">
      <h2 id="team-name" className="font-semibold">Team name</h2>
      <p className="mb-3 text-caption text-muted-foreground">Shown in the sidebar, sharing menus and invitations.</p>
      <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); act.mutate(() => api.patch(`/teams/${team.id}`, { name: formText(data, 'name') })); }}>
        <Input name="name" aria-label="Rename team" defaultValue={team.name} key={team.name} required maxLength={80} className="min-w-0 flex-1" /><Button type="submit" variant="secondary" disabled={act.isPending}>Rename team</Button>
      </form>
    </section> : null}
    <section className={`ui-panel p-4 ${archived ? '' : 'border-danger-border'}`} aria-labelledby="team-archive">
      <h2 id="team-archive" className="font-semibold">{archived ? 'Restore team' : 'Archive team'}</h2>
      <p className="mb-3 text-caption text-muted-foreground">{archived ? 'Team memberships and project shares become active again.' : 'People who see projects only through this team lose that access until it’s restored. Nothing is deleted.'}</p>
      <Button variant={archived ? 'primary' : 'secondary'} disabled={act.isPending} onClick={async () => {
        if (await confirm({ title: archived ? 'Restore team?' : 'Archive team?', description: archived ? 'Team memberships and project shares become active again.' : 'People who see projects only through this team will lose that access until the team is restored.', confirmLabel: archived ? 'Restore team' : 'Archive team', tone: archived ? 'primary' : 'danger' })) act.mutate(() => api.post(`/teams/${team.id}/${archived ? 'restore' : 'archive'}`));
      }}>{archived ? 'Restore team' : 'Archive team'}</Button>
    </section>
  </div>;
}
