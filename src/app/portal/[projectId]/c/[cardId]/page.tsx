'use client';

import { useParams } from 'next/navigation';
import { PortalCard } from '@/components/portal/portal-card';
import { usePortal } from '@/lib/portal';

export default function PortalCardPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const { project } = usePortal();
  return <PortalCard project={project} cardId={cardId} />;
}
