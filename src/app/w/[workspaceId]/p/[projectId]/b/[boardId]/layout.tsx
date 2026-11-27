import type { ReactNode } from 'react';
import BoardLayout from './layout-client';

// Built on first visit, then served from the CDN: no server function on later clicks.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Layout({ children }: { children: ReactNode }) {
  return <BoardLayout>{children}</BoardLayout>;
}
