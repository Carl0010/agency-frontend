'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { errorMessage, request } from '@/lib/api';
import { landingPath, safeNext } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { AuthResponse } from '@/lib/types';

const OAUTH_ERRORS: Record<string, string> = {
  google_state: 'Google sign-in expired. Please try again.',
  google_unverified: 'That Google account has no verified email.',
  google_failed: 'Google sign-in failed. Please try again.',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useSession();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(OAUTH_ERRORS[params.get('error') ?? ''] ?? null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await request<AuthResponse>('POST', '/auth/login', {
        body: { email: form.get('email'), password: form.get('password') },
        noRetry: true,
      });
      signIn(res);
      router.replace(next ?? (await landingPath()));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Log in"
      footer={
        <>
          New here? <Link className="font-medium text-primary" href="/signup">Create an account</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
        <div className="flex justify-between text-sm">
          <Link className="text-primary" href="/forgot">Forgot password?</Link>
          <a className="text-primary" href={`/api/v1/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
            Continue with Google
          </a>
        </div>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
