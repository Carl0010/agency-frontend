'use client';
import { useEffect, useState } from 'react';
import { nextWindowBoundary } from './board-grouping';
import type { Board } from './types';

/** Refresh on board events, exact due boundaries, local midnight and returning to a suspended tab. */
export function useGroupingClock(board: Board | undefined, timezone: string): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date(); setNow(current);
      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(1, nextWindowBoundary(board?.lists.flatMap((list) => list.cards) ?? [], current, timezone) - current.getTime()));
    };
    timer = setTimeout(tick, 0);
    document.addEventListener('visibilitychange', tick);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, [board, timezone]);
  return now;
}
