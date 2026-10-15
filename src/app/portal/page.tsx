'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { portalProjectsKey } from '@/lib/portal';
import type { Page, PortalProject } from '@/lib/types';

/** `/portal` → the guest's first granted project. */
export default function PortalIndex() {
  const router = useRouter();
  const projects = useQuery({ queryKey: portalProjectsKey, queryFn: () => api.get<Page<PortalProject>>('/portal/projects') });
  const first = projects.data?.data[0];
  useEffect(() => {
    if (first) router.replace(`/portal/${first.id}`);
  }, [first, router]);
  if (projects.isPending || first) return <Spinner />;
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-lg font-semibold">Nothing has been shared with you yet</h1>
      <p className="mt-2 text-sm text-secondary-foreground">When an agency shares a project with you, it will appear here.</p>
      <Link className="mt-4 inline-block text-sm text-primary" href="/">
        Go home
      </Link>
    </main>
  );
}
