'use client';

import { formText } from '@/lib/form';
import { useWriteAvailability } from '@/components/billing/billing-notices';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/confirmation';
import { FormError } from '@/components/auth-card';
import { GuestPanel } from '@/components/guests/guest-panel';
import { Dialog } from '@/components/ui-dialog';
import { Avatar, Button, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useTeams } from '@/lib/teams';
import type { Member, Page, Project, ProjectAccess } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

export function ProjectSharing({ project, onClose }: { project: Project; onClose: () => void }) {
  const ws = useWorkspace(); const qc = useQueryClient(); const confirm = useConfirm();
  const { readOnly } = useWriteAvailability(ws);
  const teams = useTeams(ws.id);
  const roster = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });
  const access = useQuery({ queryKey: ['project-access', project.id], queryFn: () => api.get<ProjectAccess>(`/projects/${project.id}/access`) });
  const act = useMutation({ mutationFn: (write: () => Promise<ProjectAccess>) => write(), onSuccess: async (saved) => {
    qc.setQueryData(['project-access', project.id], saved);
    await Promise.all(['projects', 'project', 'teams', 'project-people', 'assignable'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
  } });
  const sharedTeams = new Set(access.data?.teams.map((team) => team.id));
  const direct = new Set(access.data?.members.map((member) => member.userId));
  const availableTeams = (teams.data?.data ?? []).filter((team) => !sharedTeams.has(team.id));
  // The contract rejects direct grants to implicit workspace administrators (422).
  // Only the add-person choices are restricted; render the access response as returned.
  const availableMembers = (roster.data?.data ?? []).filter((member) => member.role === 'member' && member.status !== 'deactivated' && !direct.has(member.userId));
  const queryError = access.error ?? teams.error ?? roster.error;
  if (project.access !== 'admin') return null;
  return <Dialog title="Share project" onClose={onClose}>
    <p className="text-label text-muted-foreground">Share {project.name} with teams and people. Workspace owners and admins always have access. Team admins administer projects shared with their team.</p>
    <FormError message={act.error ? errorMessage(act.error) : queryError ? errorMessage(queryError) : null} />
    {queryError ? <Button variant="secondary" onClick={() => { void access.refetch(); void teams.refetch(); void roster.refetch(); }}>Retry access</Button> : null}
    {access.isPending ? <p role="status">Loading project access…</p> : access.data ? <>
      <section className="space-y-3" aria-label="Shared teams"><h3 className="font-semibold">Teams</h3>
        <ul className="divide-y divide-border">{access.data.teams.map((team) => <li key={team.id} className="flex items-center gap-2 py-2"><span className="min-w-0 flex-1 truncate text-label">{team.name} <span className="text-muted-foreground">· {team.memberCount} people</span></span><Button variant="ghost" disabled={act.isPending || readOnly} aria-label={`Unshare ${team.name}`} onClick={async () => {
          if (await confirm({ title: 'Unshare team?', description: `${team.name} will lose access to this project unless its people have another grant or shared team.`, confirmLabel: 'Unshare team' })) act.mutate(() => api.del<ProjectAccess>(`/projects/${project.id}/teams/${team.id}`));
        }}>Unshare</Button></li>)}</ul>
        {!access.data.teams.length ? <p className="text-label text-muted-foreground">No teams shared.</p> : null}
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); act.mutate(() => api.put<ProjectAccess>(`/projects/${project.id}/teams/${formText(form, 'team')}`)); }}>
          <Select name="team" aria-label="Team to share" required defaultValue="" disabled={teams.isPending || Boolean(teams.error)}><option value="" disabled>Choose team</option>{availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><Button type="submit" disabled={act.isPending || readOnly || !availableTeams.length}>Share team</Button>
        </form>
      </section>
      <section className="space-y-3 border-t border-border pt-4" aria-label="Direct project members"><h3 className="font-semibold">People</h3>
        <ul className="divide-y divide-border">{access.data.members.map((member) => <li key={member.userId} className="flex flex-wrap items-center gap-2 py-2">
          <Avatar person={{ id: member.userId, ...member }} size={28} /><span className="min-w-0 flex-1 truncate text-label">{member.name}</span>
          <Select aria-label={`Project access for ${member.name}`} value={member.access} disabled={act.isPending || readOnly} className="w-auto" onChange={(event) => { const value = event.target.value; act.mutate(() => api.put<ProjectAccess>(`/projects/${project.id}/members/${member.userId}`, { access: value })); }}><option value="edit">Can edit</option><option value="admin">Project admin</option></Select>
          <Button variant="ghost" disabled={act.isPending || readOnly} aria-label={`Remove direct access for ${member.name}`} onClick={async () => {
            if (await confirm({ title: 'Remove direct access?', description: `${member.name} keeps access through any shared teams.`, confirmLabel: 'Remove access' })) act.mutate(() => api.del<ProjectAccess>(`/projects/${project.id}/members/${member.userId}`));
          }}>Remove</Button>
        </li>)}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); act.mutate(() => api.put<ProjectAccess>(`/projects/${project.id}/members/${formText(form, 'member')}`, { access: form.get('access') })); }}>
          <Select name="member" aria-label="Person to share with" required defaultValue="" className="min-w-0 flex-1" disabled={roster.isPending || Boolean(roster.error)}><option value="" disabled>Choose person</option>{availableMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name}{member.status === 'invited' ? ' (invited)' : ''}</option>)}</Select>
          <Select name="access" aria-label="New project access" defaultValue="edit" className="w-auto"><option value="edit">Can edit</option><option value="admin">Project admin</option></Select><Button type="submit" disabled={act.isPending || readOnly || !availableMembers.length}>Share with person</Button>
        </form>
      </section>
    </> : null}
    <GuestPanel projectId={project.id} canManage />
  </Dialog>;
}
