/** Top-level member modules. The current URL owns module selection. */
export type WorkspaceModule = 'projects' | 'inbox' | 'workspace';

export const MODULE_LABELS: Record<WorkspaceModule, string> = {
  projects: 'Projects', inbox: 'Inbox', workspace: 'Workspace',
};

export function workspaceModule(pathname: string, base: string): WorkspaceModule {
  if (pathname === `${base}/inbox`) return 'inbox';
  if (pathname.startsWith(`${base}/settings/`)) return 'workspace';
  return 'projects';
}
