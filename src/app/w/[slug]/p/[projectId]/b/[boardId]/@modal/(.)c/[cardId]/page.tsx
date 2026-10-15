'use client';

import { useParams } from 'next/navigation';
import { CardDrawer } from '@/components/card/card-drawer';

export default function InterceptedCard() {
  const { slug, projectId, boardId, cardId } = useParams<{ slug: string; projectId: string; boardId: string; cardId: string }>();
  return <CardDrawer cardId={cardId} boardHref={`/w/${slug}/p/${projectId}/b/${boardId}`} />;
}
