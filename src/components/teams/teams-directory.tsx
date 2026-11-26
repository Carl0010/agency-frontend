'use client';

import Link from 'next/link';
import { FormError } from '@/components/auth-card';
import { Icon } from '@/components/icon';
import { LoadingSkeleton } from '@/components/skeleton';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useTeams } from '@/lib/teams';
import type { Team } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { canOpenAdminConsole } from '@/components/navigation/workspace-modules';

/**
 * The Teams module: the workspace's active teams and nothing else. Creating, archiving and
 * workspace-wide member management belong to Admin console → Organization; a team's own admins
 * still manage that team from its page.
 */
export function TeamsDirectory() {
  const ws = useWorkspace();
  const teams = useTeams(ws.id);
  const active = teams.data?.data.filter((team) => !team.archivedAt) ?? [];
  const mine = active.filter((team) => team.myRole !== null);
  const others = active.filter((team) => team.myRole === null);
  return <main className="ui-page">
    <PageHeader title="Teams" description="The groups people work in. Open a team to see its people and the projects shared with it." />
    <FormError message={teams.error ? errorMessage(teams.error) : null} />
    {teams.error ? <Button variant="secondary" onClick={() => void teams.refetch()}>Retry teams</Button> : null}
    {teams.isPending ? <LoadingSkeleton variant="cards" label="Loading teams" className="p-4 sm:p-6" /> : null}
    {teams.data && !active.length ? <EmptyState title="No teams yet" description={canOpenAdminConsole(ws.role) ? 'Create teams in Admin console → Teams, then share projects with them.' : 'When an admin creates a team, it appears here.'} icon="people"
      action={canOpenAdminConsole(ws.role) ? <Link href={`/w/${ws.id}/settings/teams`} className="ui-button tap border border-input bg-surface text-foreground shadow-sm hover:border-border-hover hover:bg-subtle">Create a team</Link> : undefined} /> : null}
    {mine.length ? <TeamGroup title="Your teams" teams={mine} workspaceId={ws.id} /> : null}
    {others.length ? <TeamGroup title={mine.length ? 'Other teams' : 'All teams'} teams={others} workspaceId={ws.id} /> : null}
  </main>;
}

function TeamGroup({ title, teams, workspaceId }: { title: string; teams: Team[]; workspaceId: string }) {
  return <section aria-label={title} className="mb-8">
    <h2 className="mb-3 text-label font-semibold text-muted-foreground">{title} <span className="font-normal">· {teams.length}</span></h2>
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{teams.map((team) => <li key={team.id}>
      <Link href={`/w/${workspaceId}/teams/${team.id}`} className="ui-panel flex min-h-20 items-center gap-3 p-4 hover:border-border-hover">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary-text"><Icon name="people" className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{team.name}</span>
          <span className="text-label text-muted-foreground">{team.memberCount} {team.memberCount === 1 ? 'person' : 'people'}{team.myRole === 'admin' ? ' · Team admin' : ''}</span>
        </span>
        <Icon name="chevron" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>)}</ul>
  </section>;
}
