'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { AuthCard, FormError } from '@/components/auth-card';
import { Button, Field, Input, Spinner } from '@/components/ui';
import { ApiError, errorMessage, request } from '@/lib/api';
import { rememberWorkspace } from '@/lib/landing';
import { useSession } from '@/lib/session';
import type { InvitePreview, User } from '@/lib/types';

interface AcceptResponse {
  accessToken: string | null;
  user: User;
  workspace: { id: string; slug: string };
  role: string;
  portalProjectId: string | null;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => request<InvitePreview>('GET', `/invites/${token}`, { noRetry: true }),
  });

  async function accept(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await request<AcceptResponse>('POST', `/invites/${token}/accept`, { body, noRetry: true });
      // An already-signed-in invitee keeps their current session (no new token is issued).
      if (res.accessToken) signIn({ accessToken: res.accessToken, user: res.user });
      // Guests land in their own layout tree, never the workspace (AC2).
      if (res.role === 'guest' && res.portalProjectId) {
        router.replace(`/portal/${res.portalProjectId}`);
        return;
      }
      rememberWorkspace(res.workspace.slug);
      router.replace(`/w/${res.workspace.slug}/projects`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (preview.isPending || user === undefined) return <Spinner />;
  if (preview.error) {
    const expired = preview.error instanceof ApiError && preview.error.status === 410;
    return (
      <AuthCard title={expired ? 'This invite has expired' : 'Invite not found'}>
        <p className="text-sm text-slate-700">
          {expired
            ? 'Invites are valid for 14 days. Ask the person who invited you to send a new one.'
            : 'This invite link is not valid. It may have been revoked or already used.'}
        </p>
      </AuthCard>
    );
  }

  const inv = preview.data;
  const guest = inv.role === 'guest';
  const heading = guest ? `${inv.workspaceName} shared ${inv.projectNames.join(', ') || 'a project'} with you` : `Join ${inv.workspaceName}`;
  const intro = (
    <p className="mb-4 text-sm text-slate-600">
      {inv.inviterName ?? 'Someone'} invited <strong>{inv.email}</strong>{' '}
      {guest ? 'to follow the project as a guest.' : `as ${inv.role === 'admin' ? 'an admin' : 'a member'}.`}
    </p>
  );

  if (inv.needsAccount) {
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      void accept({ name: form.get('name'), password: form.get('password') });
    };
    return (
      <AuthCard title={heading}>
        {intro}
        <form onSubmit={onSubmit} className="space-y-4">
          <FormError message={error} />
          <Field label="Your name">
            <Input name="name" autoComplete="name" required />
          </Field>
          <Field label="Choose a password" hint="At least 10 characters.">
            <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Joining…' : 'Accept invite'}
          </Button>
        </form>
      </AuthCard>
    );
  }

  // Existing account: must be signed in as the invited address to accept.
  const signedInAsInvitee = user && user.email.toLowerCase() === inv.email.toLowerCase();
  return (
    <AuthCard title={heading}>
      {intro}
      <FormError message={error} />
      {signedInAsInvitee ? (
        <Button className="mt-2 w-full" disabled={busy} onClick={() => void accept({})}>
          {busy ? 'Joining…' : 'Accept invite'}
        </Button>
      ) : (
        <p className="text-sm">
          {user ? `You're signed in as ${user.email}. ` : ''}
          <Link className="font-medium text-blue-700" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
            Log in as {inv.email}
          </Link>{' '}
          to accept.
        </p>
      )}
    </AuthCard>
  );
}
