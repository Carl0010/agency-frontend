'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { ChannelScreen } from '@/components/chat/channel-screen';

export default function ClientChannelPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <Suspense>
      <ChannelScreen key={projectId} projectId={projectId} kind="client" />
    </Suspense>
  );
}
