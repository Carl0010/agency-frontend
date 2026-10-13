'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { BoardScreen } from '@/components/board/board';

export default function BoardPage() {
  const { boardId, projectId } = useParams<{ boardId: string; projectId: string }>();
  return (
    <Suspense>
      <BoardScreen boardId={boardId} projectId={projectId} />
    </Suspense>
  );
}
