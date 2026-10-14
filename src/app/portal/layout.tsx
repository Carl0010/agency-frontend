'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Spinner } from '@/components/ui';
import { refreshSession } from '@/lib/api';
import { useUserEvent } from '@/lib/realtime';
import { useSession } from '@/lib/session';

/**
 * Root of the guest layout tree (§3.1, §3.6). Deliberately its own tree: it
 * imports no workspace nav, no search palette, no settings and no internal
 * channel route, so none of them can reach a guest's DOM even on a bug (AC2,
 * asserted by portal-bundle.spec.ts).
 */
export default function PortalRoot({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  useEffect(() => {
    if (user === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);

  // Access changed server-side (AC14): refresh the session (which re-issues
  // the audience cookie) and refetch everything with the new grants.
  useUserEvent('access.changed', () => {
    void refreshSession().then(() => qc.invalidateQueries());
  });

  if (!user) return <Spinner />;
  return <div className="h-full">{children}</div>;
}
