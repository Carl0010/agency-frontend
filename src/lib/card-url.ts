/**
 * The agency URL of a card in one of its placements, keeping the board's query (view, filters,
 * `full`). Agency only: the portal links to `/portal/{projectId}/c/{cardId}` and must not import this.
 */
export function cardUrl(workspaceId: string, placement: { projectId: string; boardId: string }, cardId: string, search = ''): string {
  return `/w/${workspaceId}/p/${placement.projectId}/b/${placement.boardId}/c/${cardId}${search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''}`;
}
