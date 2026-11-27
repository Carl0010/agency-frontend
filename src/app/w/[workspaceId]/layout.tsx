import { Suspense, type ReactNode } from 'react';
import { AppLoader } from '@/components/skeleton';
import WorkspaceLayout from './layout-client';

// Built on first visit, then served from the CDN: no server function on later clicks.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Layout({ children }: { children: ReactNode }) {
  // useSearchParams in the shell needs a boundary once the page is prerendered.
  return (
    <Suspense fallback={<AppLoader />}>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </Suspense>
  );
}
