'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input } from '@/components/ui';
import { errorMessage, request } from '@/lib/api';

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      await request('POST', '/auth/password/forgot', { body: { email: form.get('email') }, noRetry: true });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <AuthCard title="Reset your password" footer={<Link className="text-primary" href="/login">Back to log in</Link>}>
      {sent ? (
        // Same message whether or not the account exists (AC4).
        <p className="text-sm text-secondary-foreground">If an account exists for that email, a reset link is on its way.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormError message={error} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}
