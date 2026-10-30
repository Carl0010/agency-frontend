'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CardDrawer } from '@/components/card/card-drawer';
import { CardDetail } from '@/components/card/card-detail';

/** Presentation is explicit and survives reload/history: full=true, otherwise drawer. */
export default function CardPage() {
  const { workspaceId, projectId, boardId, cardId } = useParams<{ workspaceId: string; projectId: string; boardId: string; cardId: string }>();
  const boardHref = `/w/${workspaceId}/p/${projectId}/b/${boardId}`;
  const params = useSearchParams();
  const boardParams = new URLSearchParams(params.toString());
  boardParams.delete('full');
  const query = boardParams.toString();
  if (params.get('full') !== 'true') return <CardDrawer cardId={cardId} projectId={projectId} boardHref={boardHref} />;
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <Link href={`${boardHref}${query ? `?${query}` : ''}`} className="tap mb-4 inline-flex items-center text-sm text-primary">
        ← Back to board
      </Link>
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <CardDetail cardId={cardId} projectId={projectId} boardHref={boardHref} />
      </div>
    </main>
  );
}
