/** Member areas. Projects, Inbox, Teams and Admin console are rail modules; Your settings opens from the account menu. The current URL owns selection. */
export type WorkspaceModule = 'projects' | 'inbox' | 'teams' | 'admin' | 'personal';

export const MODULE_LABELS: Record<WorkspaceModule, string> = {
  projects: 'Projects', inbox: 'Inbox', teams: 'Teams', admin: 'Admin console', personal: 'Your settings',
};

/** The landing page of Your settings. */
export const PERSONAL_SETTINGS_PATH = '/me/notifications';

/** Where the Teams module opens: the teams directory, teams only. */
export const TEAMS_PATH = '/teams';

/** Where the Admin console opens: the organization's members. */
export const ADMIN_CONSOLE_PATH = '/settings/members';

/** Only workspace owners and admins get the Admin console in the rail; the API still decides every action. */
export function canOpenAdminConsole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function workspaceModule(pathname: string, base: string): WorkspaceModule {
  if (pathname === `${base}/inbox`) return 'inbox';
  if (pathname === base + TEAMS_PATH || pathname.startsWith(`${base}${TEAMS_PATH}/`)) return 'teams';
  if (pathname.startsWith(`${base}/settings/`)) return 'admin';
  if (pathname === `${base}/me` || pathname.startsWith(`${base}/me/`)) return 'personal';
  return 'projects';
}
