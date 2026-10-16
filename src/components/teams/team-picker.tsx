'use client';

import { Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { defaultTeamIds, useTeams } from '@/lib/teams';

/** Native form values keep the visible selection and submitted teamIds together. */
export function TeamPicker({ workspaceId, disabled = false }: { workspaceId: string; disabled?: boolean }) {
  const teams = useTeams(workspaceId);
  const defaults = new Set(defaultTeamIds(teams.data?.data ?? []));
  return <fieldset disabled={disabled || teams.isPending} className="space-y-2">
    <legend className="mb-2 text-label font-medium">Share with teams</legend>
    {teams.isPending ? <p role="status" className="text-label text-muted-foreground">Loading teams…</p> : null}
    {teams.error ? <div role="alert" className="text-label text-danger-text">{errorMessage(teams.error)} <Button variant="ghost" onClick={() => void teams.refetch()}>Retry teams</Button></div> : null}
    <div className="max-h-44 space-y-1 overflow-y-auto">
      {(teams.data?.data ?? []).map((team) => <label key={team.id} className="tap flex cursor-pointer items-center gap-2 rounded-md bg-background px-3 py-2 text-label">
        <input type="checkbox" name="teamIds" value={team.id} defaultChecked={defaults.has(team.id)} />
        <span className="min-w-0 flex-1 truncate">{team.name}</span><span className="text-caption text-muted-foreground">{team.memberCount} people</span>
      </label>)}
    </div>
    <p className="text-caption text-muted-foreground">With no teams selected, only the project creator and workspace owners/admins see a new project. New members need a team or a direct project share to see work.</p>
  </fieldset>;
}
