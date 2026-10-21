/** UUIDs are the permanent member URL; slugs remain supported legacy aliases. */
export const isWorkspaceId = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function workspaceLookupPath(reference: string): string {
  return isWorkspaceId(reference) ? `/workspaces/${encodeURIComponent(reference)}` : `/workspaces/by-slug/${encodeURIComponent(reference)}`;
}

export function canonicalWorkspaceUrl(pathname: string, workspaceId: string, search = '', hash = ''): string {
  return pathname.replace(/^\/w\/[^/]+/, `/w/${workspaceId}`) + search + hash;
}
