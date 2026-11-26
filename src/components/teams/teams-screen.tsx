'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { formText } from '@/lib/form';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormError } from '@/components/auth-card';
import { Button, EmptyState, Input, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useTeams } from '@/lib/teams';
import type { TeamDetail } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { TeamsList } from './teams-list';

/** Runs a team write, then refreshes everything team access can change. */
export function useTeamWrite(teamId?: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (write: () => Promise<unknown>) => write(), onSuccess: async (saved) => {
    // Only a team write answers with the team; sharing a project answers with that project's access list.
    if (teamId && saved && typeof saved === 'object' && 'members' in saved && 'id' in saved && saved.id === teamId) qc.setQueryData(['team', teamId], saved);
    await Promise.all(['teams', 'team', 'projects', 'project', 'members', 'project-people', 'project-access', 'assignable'].map((key) => qc.invalidateQueries({ queryKey: [key] })));
  } });
}

export function TeamsScreen() {
  const ws = useWorkspace(); const [archived, setArchived] = useState(false);
  const { readOnly } = useWriteAvailability(ws);
  const teams = useTeams(ws.id, archived); const create = useTeamWrite();
  return <main className="ui-page max-w-6xl">
    <PageHeader title="Teams" description="Group people and share projects with them. Team admins manage their team and its shared projects." />
    {!readOnly ? <form className="mb-6 flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4" onSubmit={(event) => {
      event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
      create.mutate(() => api.post<TeamDetail>(`/workspaces/${ws.id}/teams`, { name: formText(values, 'name') }), { onSuccess: () => form.reset() });
    }}><Input name="name" required minLength={1} maxLength={80} aria-label="Team name" placeholder="Team name" className="min-w-0 flex-1" /><Button type="submit" disabled={create.isPending}>Create team</Button></form> : null}
    <FormError message={create.error ? errorMessage(create.error) : teams.error ? errorMessage(teams.error) : null} />
    {teams.error ? <Button variant="secondary" onClick={() => void teams.refetch()}>Retry teams</Button> : null}
    {teams.isPending ? <LoadingSkeleton variant="rows" label="Loading teams" /> : teams.data?.data.length ? <TeamsList teams={teams.data.data} hrefFor={(team) => `/w/${ws.id}/settings/teams/${team.id}`}
      actions={<label className="tap flex items-center gap-2 text-label"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Include archived teams</label>} />
      : !teams.error ? <EmptyState title="No teams yet" description="Create a team, add people, and share projects with it." icon="people" /> : null}
  </main>;
}
