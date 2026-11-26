'use client';

import Link from 'next/link';
import { FormError } from '@/components/auth-card';
import { canOpenAdminConsole } from '@/components/navigation/workspace-modules';
import { LoadingSkeleton } from '@/components/skeleton';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useTeams } from '@/lib/teams';
import { useWorkspace } from '@/lib/workspace';
import { TeamsList } from './teams-list';

/**
 * The Teams module: the workspace's active teams and nothing else. Creating, archiving and
 * workspace-wide member management belong to Admin console → Organization; a team's own admins
 * still manage that team from its page.
 */
export function TeamsDirectory() {
  const ws = useWorkspace();
  const teams = useTeams(ws.id);
  const active = teams.data?.data.filter((team) => !team.archivedAt) ?? [];
  const admin = canOpenAdminConsole(ws.role);
  return <main className="ui-page">
    <PageHeader title="Teams" />
    <FormError message={teams.error ? errorMessage(teams.error) : null} />
    {teams.error ? <Button variant="secondary" onClick={() => void teams.refetch()}>Retry teams</Button> : null}
    {teams.isPending ? <LoadingSkeleton variant="rows" label="Loading teams" /> : null}
    {teams.data && !active.length ? <EmptyState title="No teams yet" description={admin ? 'Create teams in Admin console → Teams, then share projects with them.' : 'When an admin creates a team, it appears here.'} icon="people"
      action={admin ? <Link href={`/w/${ws.id}/settings/teams`} className="ui-button tap border border-input bg-surface text-foreground shadow-sm hover:border-border-hover hover:bg-subtle">Create a team</Link> : undefined} /> : null}
    {active.length ? <TeamsList teams={active} hrefFor={(team) => `/w/${ws.id}/teams/${team.id}`} /> : null}
  </main>;
}
