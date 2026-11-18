'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { CardPerson, Page } from './types';

/**
 * A card can be in several projects (docs/CARD_PLACEMENTS.md in the API repository). Its reference
 * is always its home key and number, wherever it is drawn: `WEB-42` on the Launch board too.
 */
export function cardRef(card: { key: string; number: number }): string {
  return `${card.key}-${card.number}`;
}

/**
 * A card route, sent with the project the request is made in. The API draws the tiles and details it
 * returns in that project's placement when the caller can see the card there; it never grants access.
 */
export function cardPath(cardId: string, projectId: string | null | undefined, suffix = ''): string {
  return `/cards/${cardId}${suffix}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`;
}

/** The detail as drawn in one project. `['card', id]` matches every project's copy. */
export function cardDetailKey(cardId: string, projectId: string | null | undefined) {
  return ['card', cardId, projectId ?? null] as const;
}

export type CardPeopleKind = 'assignable' | 'mentionable';

/** Everyone a card's picker offers, across all its projects, including ones the viewer cannot see. */
export function cardPeopleKey(cardId: string, kind?: CardPeopleKind) {
  return kind ? (['card-people', cardId, kind] as const) : (['card-people', cardId] as const);
}

export function useCardPeople(cardId: string, kind: CardPeopleKind, projectId?: string | null, enabled = true) {
  return useQuery({
    queryKey: cardPeopleKey(cardId, kind),
    queryFn: ({ signal }) => api.get<Page<CardPerson>>(cardPath(cardId, projectId, `/${kind}`), signal),
    enabled,
  });
}
