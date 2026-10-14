/**
 * The audience cookie the API sets on every sign-in and refresh (§3.1): the
 * workspace slugs where the user is a member+ (`m`) and the project ids they
 * hold a guest grant on (`g`). It only decides which layout tree to serve;
 * the API authorizes every request on its own.
 */
export const AUDIENCE_COOKIE = 'agency_aud';

export interface Audience {
  m: string[];
  g: string[];
}

export function parseAudience(raw: string | undefined): Audience | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const v: unknown = JSON.parse(atob(b64));
    if (typeof v !== 'object' || v === null) return null;
    const { m, g } = v as { m?: unknown; g?: unknown };
    const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);
    return { m: strings(m), g: strings(g).map((s) => s.toLowerCase()) };
  } catch {
    return null;
  }
}

/**
 * AC3: a guest is redirected off every `/w/*` route and a member off every
 * `/portal/*` route. Returns the redirect target, or null to serve the page.
 * "Guest" and "member" are per workspace: someone who is a member of A and a
 * guest of B may use both trees, each for its own workspace.
 */
export function audienceRedirect(pathname: string, aud: Audience | null): string | null {
  if (!aud) return null;
  const w = /^\/w\/([^/]+)(?:\/|$)/.exec(pathname);
  if (w) {
    const slug = decodeURIComponent(w[1] ?? '').toLowerCase();
    if (aud.m.includes(slug)) return null;
    if (aud.g[0]) return `/portal/${aud.g[0]}`;
    return null;
  }
  const p = /^\/portal(?:\/([^/]+))?(?:\/|$)/.exec(pathname);
  if (p) {
    const projectId = p[1]?.toLowerCase();
    if (projectId ? aud.g.includes(projectId) : aud.g.length > 0) return null;
    if (aud.m[0]) return `/w/${aud.m[0]}/projects`;
    return null;
  }
  return null;
}
