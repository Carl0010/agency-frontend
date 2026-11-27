'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { BoardScreen } from '@/components/board/board';
import { BoardSkeleton } from '@/components/skeleton';
import { CardDrawerHost } from '@/components/card/card-drawer';

/** The board stays in its layout while card routes and browser history change. */
export default function BoardLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<BoardSkeleton />}><BoardContent>{children}</BoardContent></Suspense>;
}

function BoardContent({ children }: { children: ReactNode }) {
  const { boardId, projectId, cardId } = useParams<{ boardId: string; projectId: string; cardId?: string }>();
  const params = useSearchParams();
  if (cardId && params.get('full') === 'true') return children;
  return <CardDrawerHost>
    <div id="board-view" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto focus:outline-none">
      <BoardScreen boardId={boardId} projectId={projectId} />
    </div>
    {children}
  </CardDrawerHost>;
}
