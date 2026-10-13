import { api } from './api';
import type { Page, Workspace } from './types';

const LAST_WS = 'agency:lastWorkspace';

export function rememberWorkspace(slug: string): void {
  try {
    localStorage.setItem(LAST_WS, slug);
  } catch {
    // Storage disabled — landing falls back to the first workspace.
  }
}

export function needsOnboarding(ws: Workspace): boolean {
  return ws.role === 'owner' && !ws.onboardingState.projectCreated && !ws.onboardingState.dismissedAt;
}

/** Where a signed-in user lands: their last workspace, or onboarding if setup is unfinished. */
export async function landingPath(): Promise<string> {
  const { data } = await api.get<Page<Workspace>>('/workspaces');
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_WS);
  } catch {
    last = null;
  }
  const ws = data.find((w) => w.slug === last) ?? data[0];
  if (!ws) return '/onboarding';
  if (needsOnboarding(ws)) return '/onboarding';
  return `/w/${ws.slug}/projects`;
}

/** Only same-origin relative paths are honoured as post-login destinations. */
export function safeNext(next: string | null): string | null {
  return next && /^\/(?!\/)/.test(next) ? next : null;
}
