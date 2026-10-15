'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { FormError } from '@/components/auth-card';
import { useToast } from '@/components/toast';
import { Avatar, Button, GuestChip, Input, Spinner } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Member, Page, Seats } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** Members, roles and the seat meter (AC5, AC7, AC8). Seat numbers come from the API, never computed here. */
export default function MembersPage() {
  const ws = useWorkspace();
  const { user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const canManage = ws.role === 'owner' || ws.role === 'admin';

  const members = useQuery({
    queryKey: ['members', ws.id],
    queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`),
  });
  const seats = useQuery({ queryKey: ['seats', ws.id], queryFn: () => api.get<Seats>(`/workspaces/${ws.id}/seats`) });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['members', ws.id] }),
      qc.invalidateQueries({ queryKey: ['seats', ws.id] }),
    ]);
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (err) => toast(errorMessage(err)),
  });

  async function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setInviteError(null);
    try {
      await api.post(`/workspaces/${ws.id}/members/invites`, { email: form.get('email'), role: form.get('role') });
      formEl.reset();
      toast('Invite sent.', 'info');
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'seat_limit_reached') {
        setInviteError(`All ${String(err.details.included)} seats are in use. Revoke an invite or deactivate a member to free one.`);
      } else setInviteError(errorMessage(err));
    }
  }

  const full = seats.data?.full ?? false;
  const rows = members.data?.data ?? [];
  const order = { active: 0, invited: 1, deactivated: 2 } as const;
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">Members</h1>
        {seats.data ? (
          <p data-testid="seat-meter" className={`text-sm font-medium ${full ? 'text-warning-text' : 'text-secondary-foreground'}`}>
            {seats.data.used} of {seats.data.included} seats used
          </p>
        ) : null}
      </div>

      {canManage ? (
        <form onSubmit={(e) => void onInvite(e)} className="mb-6 rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 font-medium">Invite a teammate</h2>
          <FormError message={inviteError} />
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Input name="email" type="email" placeholder="name@agency.com" aria-label="Email" required />
            <select name="role" aria-label="Role" defaultValue="member" className="tap rounded-md border border-input bg-surface px-2 text-sm">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit">Send invite</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A pending invite holds a seat until it is accepted or revoked.</p>
        </form>
      ) : null}

      {members.isPending ? (
        <Spinner />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {sorted.map((m) => {
            const isOwner = m.role === 'owner';
            const isSelf = m.userId === user?.id;
            const isGuest = m.role === 'guest';
            return (
              <li key={m.membershipId} data-testid="member-row" className={`flex flex-wrap items-center gap-3 p-3 ${m.status === 'deactivated' ? 'opacity-60' : ''}`}>
                <Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl, active: m.status !== 'deactivated' }} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name} {isSelf ? <span className="text-muted-foreground">(you)</span> : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.email}
                    {m.status === 'invited' ? ' · invite pending' : m.status === 'deactivated' ? ' · deactivated' : ''}
                  </p>
                </div>
                {isGuest ? (
                  <span className="flex items-center gap-2">
                    <GuestChip />
                    {canManage && m.status !== 'deactivated' ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          if (window.confirm(`Make ${m.name} a member? They will see every project and use a seat.`)) {
                            act.mutate(() => api.patch(`/workspaces/${ws.id}/members/${m.userId}`, { role: 'member' }));
                          }
                        }}
                      >
                        Promote to member
                      </Button>
                    ) : null}
                  </span>
                ) : canManage && !isOwner && m.status === 'active' ? (
                  <select
                    aria-label={`Role for ${m.name}`}
                    value={m.role}
                    onChange={(e) => act.mutate(() => api.patch(`/workspaces/${ws.id}/members/${m.userId}`, { role: e.target.value }))}
                    className="tap rounded-md border border-input bg-surface px-2 py-1 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className="text-sm capitalize text-secondary-foreground">{m.role}</span>
                )}
                {canManage && m.status === 'invited' && !isGuest ? (
                  <Button variant="secondary" onClick={() => act.mutate(() => api.del(`/workspaces/${ws.id}/members/invites/${m.membershipId}`))}>
                    Revoke
                  </Button>
                ) : null}
                {canManage && !isOwner && !isSelf && !isGuest && m.status === 'active' ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm(`Deactivate ${m.name}? Their cards and comments stay; the seat is freed.`)) {
                        act.mutate(() => api.del(`/workspaces/${ws.id}/members/${m.userId}`));
                      }
                    }}
                  >
                    Deactivate
                  </Button>
                ) : null}
                {canManage && m.status === 'deactivated' && !isGuest ? (
                  <Button variant="secondary" onClick={() => act.mutate(() => api.patch(`/workspaces/${ws.id}/members/${m.userId}`, { status: 'active' }))}>
                    Reactivate
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
