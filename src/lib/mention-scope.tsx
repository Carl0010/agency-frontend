'use client';

import { createContext, useContext } from 'react';

/**
 * The surface a composer writes to. Mention autocomplete is scoped to it: a
 * project's guests are mentionable on its cards and shared channel but never
 * in the internal one, and a guest's own autocomplete only lists people who
 * have posted where they can read (AC7). The API enforces the same rule.
 */
export interface MentionScope {
  projectId: string;
  surface: 'card' | 'shared' | 'internal';
}

export const MentionScopeContext = createContext<MentionScope | null>(null);

export function useMentionScope(): MentionScope | null {
  return useContext(MentionScopeContext);
}

export function mentionableQuery(scope: MentionScope | null): string {
  return scope ? `mentionable=true&projectId=${scope.projectId}&surface=${scope.surface}` : 'mentionable=true';
}
