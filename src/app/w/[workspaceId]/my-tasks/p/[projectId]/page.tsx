'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Where a closed card from My tasks lands: back to the board, in the same view. */
export default function MyTasksProjectPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  useEffect(() => router.replace(`/w/${workspaceId}/my-tasks${window.location.search}`, { scroll: false }), [router, workspaceId]);
  return null;
}
