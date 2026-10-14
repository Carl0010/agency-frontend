'use client';

import { PortalBoard } from '@/components/portal/portal-board';
import { usePortal } from '@/lib/portal';

export default function PortalBoardPage() {
  const { project } = usePortal();
  return <PortalBoard project={project} />;
}
