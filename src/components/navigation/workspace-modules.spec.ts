import { workspaceModule } from './workspace-modules';

describe('workspaceModule', () => {
  const base = '/w/ws-1';
  it.each([
    ['/w/ws-1/projects', 'projects'],
    ['/w/ws-1/p/p-1/b/b-1', 'projects'],
    ['/w/ws-1/inbox', 'inbox'],
    ['/w/ws-1/settings/members', 'workspace'],
    ['/w/ws-1/me', 'personal'],
    ['/w/ws-1/me/notifications', 'personal'],
    ['/w/ws-1/me/appearance', 'personal'],
    ['/w/ws-1/meetings', 'projects'],
  ])('%s → %s', (path, expected) => { expect(workspaceModule(path, base)).toBe(expected); });
});
