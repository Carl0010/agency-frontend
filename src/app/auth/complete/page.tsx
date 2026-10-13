'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { landingPath, safeNext } from '@/lib/landing';
import { useSession } from '@/lib/session';

/** Google OAuth lands here after the API set the refresh cookie; the session provider restores the token. */
function Complete() {
  const { user } = useSession();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));

  useEffect(() => {
    if (user === null) router.replace('/login?error=google_failed');
    if (user) void (next && next !== '/' ? Promise.resolve(next) : landingPath()).then((p) => router.replace(p));
  }, [user, next, router]);

  return <Spinner label="Signing you in…" />;
}

export default function CompletePage() {
  return (
    <Suspense>
      <Complete />
    </Suspense>
  );
}
