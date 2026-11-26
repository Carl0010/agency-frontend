'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { formText } from '@/lib/form';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormError } from '@/components/auth-card';
import { Badge, Button, EmptyState, Input, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useTeams } from '@/lib/teams';
import type { TeamDetail } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { useWriteAvailability } from '@/components/billing/billing-notices';

/** Runs a team write, then refreshes everything team access can change. */
export function useTeamWrite(teamId?: string) {
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
    {teams.isPending ? <LoadingSkeleton variant="cards" className="p-4 sm:p-6" /> : teams.data?.data.length ? <ul className="grid gap-3 sm:grid-cols-2">{teams.data.data.map((team) => <li key={team.id}>
      <Link href={`/w/${ws.id}/settings/teams/${team.id}`} className="ui-panel flex min-h-24 items-center gap-3 p-4 hover:border-border-hover"><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{team.name}</span><span className="text-label text-muted-foreground">{team.memberCount} {team.memberCount === 1 ? 'person' : 'people'}{team.myRole ? ` · ${team.myRole === 'admin' ? 'Team admin' : 'Team member'}` : ''}</span></span>{team.archivedAt ? <Badge>Archived</Badge> : null}</Link>
    </li>)}</ul> : !teams.error ? <EmptyState title="No teams yet" description="Create a team, add people, and share projects with it." icon="people" /> : null}
  </main>;
}
