'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';

/** Do not navigate to an already-open card; modified clicks still open a new tab. */
export function CardLink({ cardId, onClick, ...props }: ComponentProps<typeof Link> & { cardId: string }) {
  const selected = usePathname().endsWith(`/c/${cardId}`);
  return <Link {...props} aria-expanded={selected} aria-controls={selected ? 'card-drawer' : undefined} onClick={(event) => {
    if (selected && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
    onClick?.(event);
  }} />;
}
