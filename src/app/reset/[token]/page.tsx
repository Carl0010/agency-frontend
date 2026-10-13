'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { errorMessage, request } from '@/lib/api';

export default function ResetPage() {
  const { token } = useParams<{ token: string }>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request('POST', '/auth/password/reset', { body: { token, password: form.get('password') }, noRetry: true });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <AuthCard title="Choose a new password">
      {done ? (
        <p className="text-sm">
          Password updated. You were signed out everywhere. <Link className="text-blue-700" href="/login">Log in</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormError message={error} />
          <Field label="New password" hint="At least 10 characters.">
            <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <Button type="submit" className="w-full">Set password</Button>
        </form>
      )}
    </AuthCard>
  );
}
