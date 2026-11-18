'use client';

import { createContext, useContext } from 'react';

/**
 * The surface a composer writes to. Mention autocomplete is scoped to it: a
 * project's guests are mentionable on its cards and shared channel but never
 * in the internal one, and a guest's own autocomplete only lists people who
 * have posted where they can read (AC7). The API enforces the same rule.
 * A card can be in several projects, so its composers name the card: its
 * mentionable people are everyone who can see it, not one project's readers.
 */
export interface MentionScope {
  projectId: string;
  surface: 'card' | 'shared' | 'internal';
  cardId?: string;
}

export const MentionScopeContext = createContext<MentionScope | null>(null);

export function useMentionScope(): MentionScope | null {
  return useContext(MentionScopeContext);
}

export function mentionableQuery(scope: MentionScope | null): string {
  return scope ? `mentionable=true&projectId=${scope.projectId}&surface=${scope.surface}` : 'mentionable=true';
}

/** Where a composer's mention candidates come from: the card's own read, or the workspace roster for a channel. */
export function mentionablePath(workspaceId: string, scope: MentionScope | null): string {
  if (scope?.surface === 'card' && scope.cardId) return `/cards/${scope.cardId}/mentionable?project=${encodeURIComponent(scope.projectId)}`;
  return `/workspaces/${workspaceId}/members?${mentionableQuery(scope)}`;
}
