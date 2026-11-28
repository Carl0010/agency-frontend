'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Where a closed card from My work lands: back to the list. */
export default function MyWorkProjectPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const router = useRouter();
  useEffect(() => router.replace(`/w/${workspaceId}/my-work`, { scroll: false }), [router, workspaceId]);
  return null;
}
