'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { CardDrawerHost } from '@/components/card/card-drawer';
import { MyTasksScreen } from '@/components/my-tasks/my-tasks-screen';
import { BoardSkeleton } from '@/components/skeleton';

/** My tasks stays in its layout while a card opens beside it, as on a board. */
export default function MyTasksLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<BoardSkeleton view="kanban" />}><MyTasksContent>{children}</MyTasksContent></Suspense>;
}

function MyTasksContent({ children }: { children: ReactNode }) {
  const { cardId } = useParams<{ cardId?: string }>();
  const params = useSearchParams();
  if (cardId && params.get('full') === 'true') return children;
  return <CardDrawerHost>
    {/* The drawer's "Focus board" moves focus back here. */}
    <div id="board-view" tabIndex={-1} className="min-h-0 min-w-0 flex-1 focus:outline-none">
      <MyTasksScreen />
    </div>
    {children}
  </CardDrawerHost>;
}
