'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/toast';
import { Avatar, Button, Input } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { GuestAccess, Page, ProjectGuest } from '@/lib/types';

const guestsKey = (projectId: string) => ['project-guests', projectId] as const;

const ACCESS_LABEL: Record<GuestAccess, string> = { read: 'Can view', comment: 'Can comment' };

/**
 * A project's guest panel (§6.3, AC1): any member+ invites a client contact by
 * email with `read` or `comment` access, flips access, or removes them.
 * Guests are free — the panel says so, and no seat check runs.
 */
export function GuestsButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="guests-button"
        onClick={() => setOpen(true)}
        className="tap flex items-center rounded px-2 text-sm text-slate-600 hover:bg-slate-50"
      >
        Share with client
      </button>
      {open ? <GuestPanel projectId={projectId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GuestPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<GuestAccess>('comment');
  const [busy, setBusy] = useState(false);
  const guests = useQuery({ queryKey: guestsKey(projectId), queryFn: () => api.get<Page<ProjectGuest>>(`/projects/${projectId}/guests`) });
  const refresh = () => qc.invalidateQueries({ queryKey: guestsKey(projectId) });

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post<ProjectGuest>(`/projects/${projectId}/guests`, { email: email.trim(), access });
      setEmail('');
      toast('Invite sent.', 'info');
      await refresh();
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function change(g: ProjectGuest, next: GuestAccess) {
    try {
      await api.patch<ProjectGuest>(`/projects/${projectId}/guests/${g.userId}`, { access: next });
      await refresh();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove(g: ProjectGuest) {
    if (!window.confirm(`Remove ${g.name}'s access to this project? Their comments and messages stay.`)) return;
    try {
      await api.del(`/projects/${projectId}/guests/${g.userId}`);
      await refresh();
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-4 pt-16" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guests"
        data-testid="guest-panel"
        className="w-full max-w-lg space-y-4 rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <header className="flex items-center justify-between">
          <h2 className="font-semibold">Share with your client</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="tap rounded px-2 text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </header>
        <p className="text-sm text-slate-600">
          Guests see this project&apos;s board and its Client chat — never the Team channel, other projects or who is assigned. Guests don&apos;t use a seat.
        </p>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => void invite(e)}>
          <Input
            type="email"
            required
            aria-label="Guest email"
            placeholder="client@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-0 flex-1"
          />
          <select
            aria-label="Access"
            value={access}
            onChange={(e) => setAccess(e.target.value as GuestAccess)}
            className="tap rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="comment">{ACCESS_LABEL.comment}</option>
            <option value="read">{ACCESS_LABEL.read}</option>
          </select>
          <Button type="submit" disabled={busy || !email.trim()}>
            Invite
          </Button>
        </form>
        <ul className="divide-y divide-slate-100" aria-label="Project guests">
          {(guests.data?.data ?? []).map((g) => (
            <li key={g.userId} className="flex items-center gap-2 py-2" data-testid="guest-row">
              <Avatar person={{ id: g.userId, name: g.name, avatarUrl: g.avatarUrl }} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {g.email}
                  {g.status === 'invited' ? ' · invited' : ''}
                </p>
              </div>
              <select
                aria-label={`Access for ${g.name}`}
                value={g.access}
                onChange={(e) => void change(g, e.target.value as GuestAccess)}
                className="tap rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="comment">{ACCESS_LABEL.comment}</option>
                <option value="read">{ACCESS_LABEL.read}</option>
              </select>
              <Button variant="ghost" onClick={() => void remove(g)}>
                Remove
              </Button>
            </li>
          ))}
          {guests.data && guests.data.data.length === 0 ? <li className="py-2 text-sm text-slate-500">No guests yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
