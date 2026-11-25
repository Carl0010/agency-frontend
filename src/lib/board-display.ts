'use client';

import { useSearchParams } from 'next/navigation';

/**
 * What a board shows beyond the essentials, kept in the URL like view and filters (shareable,
 * survives reload). Arrival estimates are opt-in (`?arrival=on`): most people read a card by its
 * title, due date and owner, and the estimate lives in the card's details anyway.
 */
export function useShowArrivals(): boolean {
  return useSearchParams().get('arrival') === 'on';
}

/** The URL with arrival estimates turned on or off, keeping every other parameter. */
export function withArrivals(search: string, on: boolean): URLSearchParams {
  const next = new URLSearchParams(search);
  if (on) next.set('arrival', 'on');
  else next.delete('arrival');
  return next;
}
