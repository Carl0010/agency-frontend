'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { landingPath } from '@/lib/landing';
import { useSession } from '@/lib/session';

export default function Home() {
  const { user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user) void landingPath().then((p) => router.replace(p));
  }, [user, router]);

  if (user !== null) return <Spinner />;
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Client work, one place.</h1>
      <p className="text-lg text-slate-600">Boards, cards and comments for agencies of five. Built to replace Trello + Slack.</p>
      <div className="flex gap-3">
        <Link href="/signup" className="tap rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          Start free trial
        </Link>
        <Link href="/login" className="tap rounded-md border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50">
          Log in
        </Link>
      </div>
    </main>
  );
}
