import { canOpenAdminConsole, workspaceModule } from './workspace-modules';

describe('workspaceModule', () => {
  const base = '/w/ws-1';
  it.each([
    ['/w/ws-1/my-tasks', 'my-tasks'],
    ['/w/ws-1/my-tasks/p/p-1/c/c-1', 'my-tasks'],
    ['/w/ws-1/my-tasksheet', 'projects'],
    ['/w/ws-1/projects', 'projects'],
    ['/w/ws-1/p/p-1/b/b-1', 'projects'],
    ['/w/ws-1/inbox', 'inbox'],
    ['/w/ws-1/settings/members', 'admin'],
    ['/w/ws-1/settings/teams', 'admin'],
    ['/w/ws-1/settings/teams/t-1', 'admin'],
    ['/w/ws-1/teams', 'teams'],
    ['/w/ws-1/teams/t-1', 'teams'],
    ['/w/ws-1/teamsheet', 'projects'],
    ['/w/ws-1/me', 'personal'],
    ['/w/ws-1/me/notifications', 'personal'],
    ['/w/ws-1/me/appearance', 'personal'],
    ['/w/ws-1/meetings', 'projects'],
  ])('%s → %s', (path, expected) => { expect(workspaceModule(path, base)).toBe(expected); });
});

describe('canOpenAdminConsole', () => {
  it.each([['owner', true], ['admin', true], ['member', false], [null, false]] as const)('%s → %s', (role, expected) => {
    expect(canOpenAdminConsole(role)).toBe(expected);
  });
});
