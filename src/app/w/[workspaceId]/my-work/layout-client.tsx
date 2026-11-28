'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { CardDrawerHost } from '@/components/card/card-drawer';
import { MyWorkScreen } from '@/components/my-work';
import { LoadingSkeleton } from '@/components/skeleton';

/** My work stays in its layout while a card opens beside it, as on a board. */
export default function MyWorkLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingSkeleton label="Loading your work" />}><MyWorkContent>{children}</MyWorkContent></Suspense>;
}

function MyWorkContent({ children }: { children: ReactNode }) {
  const { cardId } = useParams<{ cardId?: string }>();
  const params = useSearchParams();
  if (cardId && params.get('full') === 'true') return children;
  return <CardDrawerHost>
    {/* The drawer's "Focus board" moves focus back here. */}
    <div id="board-view" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
      <MyWorkScreen />
    </div>
    {children}
  </CardDrawerHost>;
}
