'use client';

import { useParams } from 'next/navigation';
import { CardModal } from '@/components/card/card-modal';

export default function InterceptedCard() {
  const { slug, projectId, boardId, cardId } = useParams<{ slug: string; projectId: string; boardId: string; cardId: string }>();
  return <CardModal cardId={cardId} boardHref={`/w/${slug}/p/${projectId}/b/${boardId}`} />;
}
