'use client';

import { formText } from '@/lib/form';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormError } from '@/components/auth-card';
import { useConfirm } from '@/components/confirmation';
import { Avatar, Badge, Button, EmptyState, Field, Input, PageHeader, Select, Spinner } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useTeams } from '@/lib/teams';
import type { Member, Page, TeamDetail } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { useWriteAvailability } from '@/components/billing/billing-notices';

function useTeamWrite(teamId?: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (write: () => Promise<unknown>) => write(), onSuccess: async (saved) => {
    if (teamId && saved && typeof saved === 'object' && 'members' in saved) qc.setQueryData(['team', teamId], saved);
    await Promise.all(['teams', 'team', 'projects', 'project', 'members', 'project-people', 'project-access', 'assignable'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
  } });
}

export function TeamsScreen() {
  const ws = useWorkspace(); const [archived, setArchived] = useState(false);
  const { readOnly } = useWriteAvailability(ws);
  const teams = useTeams(ws.id, archived); const create = useTeamWrite();
  return <main className="ui-page">
    <PageHeader title="Teams" description="Group people and share projects with them. Team admins manage their team and its shared projects." />
    {!readOnly ? <form className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4" onSubmit={(event) => {
      event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
      create.mutate(() => api.post<TeamDetail>(`/workspaces/${ws.id}/teams`, { name: formText(values, 'name') }), { onSuccess: () => form.reset() });
    }}><Input name="name" required minLength={1} maxLength={80} aria-label="Team name" placeholder="Team name" className="min-w-0 flex-1" /><Button type="submit" disabled={create.isPending}>Create team</Button></form> : null}
    <FormError message={create.error ? errorMessage(create.error) : teams.error ? errorMessage(teams.error) : null} />
    {teams.error ? <Button variant="secondary" onClick={() => void teams.refetch()}>Retry teams</Button> : null}
    <label className="tap mb-4 flex items-center gap-2 text-label"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Include archived teams</label>
    {teams.isPending ? <Spinner /> : teams.data?.data.length ? <ul className="grid gap-3 sm:grid-cols-2">{teams.data.data.map((team) => <li key={team.id}>
      <Link href={`/w/${ws.slug}/settings/teams/${team.id}`} className="ui-panel flex min-h-24 items-center gap-3 p-4 hover:border-border-hover"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{team.name}</span><span className="text-label text-muted-foreground">{team.memberCount} people{team.myRole ? ` · ${team.myRole === 'admin' ? 'Team admin' : 'Team member'}` : ''}</span></span>{team.archivedAt ? <Badge>Archived</Badge> : null}</Link>
    </li>)}</ul> : !teams.error ? <EmptyState title="No teams yet" description="Create a team, add people, and share projects with it." icon="people" /> : null}
  </main>;
}

export function TeamScreen({ teamId }: { teamId: string }) {
  const ws = useWorkspace(); const { user } = useSession(); const confirm = useConfirm();
  const { readOnly, invitesBlocked } = useWriteAvailability(ws);
  const team = useQuery({ queryKey: ['team', teamId], queryFn: ({ signal }) => api.get<TeamDetail>(`/teams/${teamId}`, signal) });
  const roster = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });
  const act = useTeamWrite(teamId); const [personId, setPersonId] = useState('');
  if (team.isPending) return <Spinner />;
  if (team.error) return <main className="ui-page"><PageHeader title={team.error instanceof ApiError && team.error.code === 'not_found' ? 'Team unavailable' : 'Could not load team'} /><FormError message={errorMessage(team.error)} /><Button variant="secondary" onClick={() => void team.refetch()}>Retry team</Button></main>;
  const t = team.data; const archived = Boolean(t.archivedAt);
  const canManage = !readOnly && (ws.role === 'owner' || ws.role === 'admin' || t.myRole === 'admin');
  const adminCount = t.members.filter((member) => !member.guest && member.role === 'admin').length;
  const members = new Set(t.members.map((member) => member.userId));
  const available = (roster.data?.data ?? []).filter((member) => member.status !== 'deactivated' && !members.has(member.userId));
  const selected = available.find((member) => member.userId === personId);
  return <main className="ui-page max-w-3xl">
    <Link href={`/w/${ws.slug}/settings/teams`} className="mb-4 inline-block text-label text-primary">← All teams</Link>
    <PageHeader title={t.name} description={`${t.memberCount} people${archived ? ' · Archived' : ''}`} actions={canManage ? <Button variant="secondary" disabled={act.isPending} onClick={async () => {
      if (await confirm({ title: archived ? 'Restore team?' : 'Archive team?', description: archived ? 'Team memberships and project shares become active again.' : 'People who see projects only through this team will lose that access until the team is restored.', confirmLabel: archived ? 'Restore team' : 'Archive team', tone: archived ? 'primary' : 'danger' })) act.mutate(() => api.post(`/teams/${teamId}/${archived ? 'restore' : 'archive'}`));
    }}>{archived ? 'Restore team' : 'Archive team'}</Button> : null} />
    <FormError message={act.error ? errorMessage(act.error) : roster.error ? errorMessage(roster.error) : null} />
    {roster.error ? <Button variant="secondary" onClick={() => void roster.refetch()}>Retry people</Button> : null}
    {archived ? <p className="mb-4 rounded-lg border border-warning-border bg-warning-subtle p-3 text-label text-warning-text">This team is archived. Restore it to change its name or people.</p> : null}
    {canManage && !archived ? <form className="mb-5 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); act.mutate(() => api.patch(`/teams/${teamId}`, { name: formText(data, 'name') })); }}>
      <Input name="name" aria-label="Rename team" defaultValue={t.name} key={t.name} required maxLength={80} className="min-w-0 flex-1" /><Button type="submit" variant="secondary" disabled={act.isPending}>Rename team</Button>
    </form> : null}
    <section className="ui-panel mb-5 p-4" aria-label="Team members"><h2 className="mb-2 font-semibold">People</h2><ul className="divide-y divide-border">
      {t.members.map((member) => {
        const lastAdmin = !member.guest && member.role === 'admin' && adminCount === 1;
        const self = member.userId === user?.id;
        return <li key={member.userId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3" data-testid="team-member-row">
          <div className="flex min-w-0 flex-1 items-center gap-3" data-testid="team-member-identity"><Avatar person={{ id: member.userId, ...member }} size={28} /><div className="min-w-0 flex-1"><p className="break-words text-label font-medium">{member.name}{self ? ' (you)' : ''}</p><p className="text-caption text-muted-foreground">{member.guest ? 'Guest' : member.role === 'admin' ? 'Team admin' : 'Team member'}{member.status === 'invited' ? ' · invited' : ''}{lastAdmin ? ' · Last admin' : ''}</p></div></div>
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0" data-testid="team-member-controls">
          {canManage && !archived && !lastAdmin ? <Select aria-label={`${member.guest ? 'Guest access' : 'Team role'} for ${member.name}`} value={member.guest ? member.access ?? 'comment' : member.role} disabled={act.isPending} className="w-auto" onChange={(event) => {
            const value = event.target.value; act.mutate(() => api.put(`/teams/${teamId}/members/${member.userId}`, member.guest ? { access: value } : { role: value }));
          }}>{member.guest ? <><option value="comment">Can comment</option><option value="read">Can view</option></> : <><option value="member">Team member</option><option value="admin">Team admin</option></>}</Select> : member.guest ? <Badge>{member.access === 'comment' ? 'Can comment' : 'Can view'}</Badge> : null}
          {!readOnly && !archived && !lastAdmin && (canManage || self) ? <Button variant="ghost" disabled={act.isPending} aria-label={`${self ? 'Leave team' : `Remove ${member.name}`}`} onClick={async () => {
            if (await confirm({ title: self ? 'Leave team?' : 'Remove person from team?', description: 'Access through this team will end. Other project grants and shared teams remain. A guest loses workspace membership if this was their last team or project.', confirmLabel: self ? 'Leave team' : 'Remove person' })) act.mutate(() => api.del(`/teams/${teamId}/members/${member.userId}`));
          }}>{self ? 'Leave' : 'Remove'}</Button> : null}
          </div>
        </li>;
      })}
    </ul></section>
    {canManage && !archived ? <>
      <form className="ui-panel mb-5 space-y-3 p-4" onSubmit={(event) => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        act.mutate(() => api.put(`/teams/${teamId}/members/${personId}`, selected?.role === 'guest' ? { access: data.get('access') } : { role: data.get('role') }), { onSuccess: () => setPersonId('') });
      }}><h2 className="font-semibold">Add workspace person</h2><div className="flex flex-wrap gap-2">
        <Select aria-label="Person to add" value={personId} required onChange={(event) => setPersonId(event.target.value)} className="min-w-0 basis-full sm:flex-1 sm:basis-auto"><option value="" disabled>Choose person</option>{available.map((member) => <option key={member.userId} value={member.userId}>{member.name}{member.role === 'guest' ? ' (guest)' : ''}{member.status === 'invited' ? ' (invited)' : ''}</option>)}</Select>
        {selected?.role === 'guest' ? <Select name="access" aria-label="New team guest access" defaultValue="comment" className="w-auto"><option value="comment">Can comment</option><option value="read">Can view</option></Select> : <Select name="role" aria-label="New team role" defaultValue="member" className="w-auto"><option value="member">Team member</option><option value="admin">Team admin</option></Select>}
        <Button type="submit" disabled={act.isPending || !selected}>Add person</Button></div>
      </form>
      <form className="ui-panel space-y-3 p-4" onSubmit={(event) => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        act.mutate(() => api.post(`/teams/${teamId}/guests`, { email: formText(data, 'email'), access: data.get('access') }), { onSuccess: () => form.reset() });
      }}><h2 className="font-semibold">Invite a guest to this team</h2><p className="text-label text-muted-foreground">Guests see every project shared with this team at the selected access level. They never use seats or become team admins.</p>
        <Field label="Guest email"><Input name="email" type="email" required maxLength={254} placeholder="guest@example.com" /></Field>
        <div className="flex flex-wrap gap-2"><Select name="access" aria-label="Team guest access" defaultValue="comment" className="w-auto"><option value="comment">Can comment</option><option value="read">Can view</option></Select><Button type="submit" disabled={act.isPending || invitesBlocked}>Invite guest to team</Button></div>
      </form>
    </> : null}
  </main>;
}
