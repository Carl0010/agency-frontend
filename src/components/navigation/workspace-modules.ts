/** Member areas. Projects, Inbox and Workspace are rail modules; Your settings opens from the account menu. The current URL owns selection. */
export type WorkspaceModule = 'projects' | 'inbox' | 'workspace' | 'personal';

export const MODULE_LABELS: Record<WorkspaceModule, string> = {
  projects: 'Projects', inbox: 'Inbox', workspace: 'Workspace', personal: 'Your settings',
};

/** The landing page of Your settings. */
export const PERSONAL_SETTINGS_PATH = '/me/notifications';

export function workspaceModule(pathname: string, base: string): WorkspaceModule {
  if (pathname === `${base}/inbox`) return 'inbox';
  if (pathname.startsWith(`${base}/settings/`)) return 'workspace';
  if (pathname === `${base}/me` || pathname.startsWith(`${base}/me/`)) return 'personal';
  return 'projects';
}
