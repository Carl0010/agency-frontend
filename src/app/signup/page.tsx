'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { errorMessage, request } from '@/lib/api';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { AuthResponse } from '@/lib/types';

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await request<AuthResponse & { workspace: { id: string; slug: string } }>('POST', '/auth/signup', {
        body: {
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        noRetry: true,
      });
      signIn(res);
      rememberWorkspace(res.workspace.slug);
      router.replace('/onboarding');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Start your 14-day trial"
      footer={
        <>
          Already have an account? <Link className="font-medium text-primary" href="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Your name">
          <Input name="name" autoComplete="name" required maxLength={200} />
        </Field>
        <Field label="Work email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least 10 characters.">
          <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
        <a className="tap block rounded-md border border-input py-2 text-center text-sm font-medium hover:bg-background" href="/api/v1/auth/google">
          Sign up with Google
        </a>
      </form>
    </AuthCard>
  );
}
