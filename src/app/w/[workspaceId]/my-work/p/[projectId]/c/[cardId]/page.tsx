'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CardDetail } from '@/components/card/card-detail';
import { CardDrawer } from '@/components/card/card-drawer';

/** A card opened from My work: the drawer beside the list, or the full page with full=true. */
export default function MyWorkCardPage() {
  const { workspaceId, projectId, cardId } = useParams<{ workspaceId: string; projectId: string; cardId: string }>();
  const params = useSearchParams();
  // The drawer closes to this address and opens the full page under it.
  const boardHref = `/w/${workspaceId}/my-work/p/${projectId}`;
  if (params.get('full') !== 'true') return <CardDrawer cardId={cardId} projectId={projectId} boardHref={boardHref} />;
  return (
    <main className="ui-page">
      <Link href={`/w/${workspaceId}/my-work`} className="tap mb-4 inline-flex items-center text-sm text-primary">
        ← Back to My work
      </Link>
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <CardDetail cardId={cardId} projectId={projectId} />
      </div>
    </main>
  );
}
