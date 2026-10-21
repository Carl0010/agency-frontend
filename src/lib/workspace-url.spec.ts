import { canonicalWorkspaceUrl, isWorkspaceId, workspaceLookupPath } from './workspace-url';

const W = '11111111-1111-4111-8111-111111111111';

describe('workspace URLs: the id is canonical, the slug a legacy alias', () => {
  it('tells an id from a slug', () => {
    expect(isWorkspaceId(W)).toBe(true);
    expect(isWorkspaceId(W.toUpperCase())).toBe(true);
    expect(isWorkspaceId('northlight')).toBe(false);
    expect(isWorkspaceId(`${W}-x`)).toBe(false);
  });

  it('looks a workspace up by id or by slug', () => {
    expect(workspaceLookupPath(W)).toBe(`/workspaces/${W}`);
    expect(workspaceLookupPath('northlight')).toBe('/workspaces/by-slug/northlight');
  });

  it('rewrites only the workspace segment and keeps the rest of the link', () => {
    expect(canonicalWorkspaceUrl('/w/northlight/p/p1/b/b1/c/c1', W, '?full=true', '#comment')).toBe(`/w/${W}/p/p1/b/b1/c/c1?full=true#comment`);
    expect(canonicalWorkspaceUrl('/w/northlight', W)).toBe(`/w/${W}`);
  });
});
