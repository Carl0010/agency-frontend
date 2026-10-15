'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CardDetail } from '@/components/card/card-detail';

/** Hard load of a card URL renders the detail full-page (§3.3). */
export default function CardPage() {
  const { slug, projectId, boardId, cardId } = useParams<{ slug: string; projectId: string; boardId: string; cardId: string }>();
  const boardHref = `/w/${slug}/p/${projectId}/b/${boardId}`;
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-8">
      <Link href={boardHref} className="tap mb-4 inline-flex items-center text-sm text-primary">
        ← Back to board
      </Link>
      <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <CardDetail cardId={cardId} boardHref={boardHref} />
      </div>
    </main>
  );
}
