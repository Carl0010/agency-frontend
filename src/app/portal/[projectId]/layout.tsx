import { Suspense, type ReactNode } from 'react';
import { LoadingSkeleton } from '@/components/skeleton';
import PortalProjectLayout from './layout-client';

// Built on first visit, then served from the CDN: no server function on later clicks.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Layout({ children }: { children: ReactNode }) {
  // useSearchParams below needs a boundary once the page is prerendered.
  return (
    <Suspense fallback={<LoadingSkeleton variant="cards" className="p-4 sm:p-6" />}>
      <PortalProjectLayout>{children}</PortalProjectLayout>
    </Suspense>
  );
}
