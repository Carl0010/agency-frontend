'use client';

import { useEffect, useState } from 'react';

/** Current time, re-rendered every `intervalMs`. Due pills read this rather than calling Date.now() in render. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
