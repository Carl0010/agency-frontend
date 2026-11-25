'use client';

import { useSyncExternalStore } from 'react';

/** dnd-kit's auto-scroll settings (the `autoScroll` prop of `DndContext`). */
export interface DragAutoScroll {
  acceleration: number;
  interval: number;
  threshold: { x: number; y: number };
}

const NARROW = '(max-width: 639px)';

/**
 * How fast the board scrolls while a card is dragged near an edge. dnd-kit's default (up to 10px
 * every 5ms inside the outer 20%) flies past several columns on a phone, where a finger is almost
 * always near an edge. Phones get a narrower edge zone and at most 3px every 10ms (300px a second).
 */
export function dragAutoScroll(narrow: boolean): DragAutoScroll | undefined {
  if (!narrow) return undefined;
  return { acceleration: 3, interval: 10, threshold: { x: 0.12, y: 0.1 } };
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** The auto-scroll settings for the current screen width. */
export function useDragAutoScroll(): DragAutoScroll | undefined {
  const narrow = useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);
  return dragAutoScroll(narrow);
}
