'use client';

import { formText } from '@/lib/form';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/confirmation';
import { FormError } from '@/components/auth-card';
import { Avatar, Button, Input, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { GuestAccess, Page, ProjectGuest } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';
import { useWriteAvailability } from '@/components/billing/billing-notices';

/** Direct guest grants; team-based guests are managed in Teams. Member tree only. */
export function GuestPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const ws = useWorkspace(); const { readOnly, invitesBlocked } = useWriteAvailability(ws);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const guests = useQuery({ queryKey: ['project-guests', projectId], queryFn: () => api.get<Page<ProjectGuest>>(`/projects/${projectId}/guests`) });
  const act = useMutation({
    mutationFn: (write: () => Promise<unknown>) => write(),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['project-guests', projectId] }); await qc.invalidateQueries({ queryKey: ['members'] }); },
  });
  return <section data-testid="guest-panel" aria-label="Project guests" className="space-y-3 border-t border-border pt-4">
    <h3 className="font-semibold">Guests</h3>
    <p className="text-label text-muted-foreground">Guests see the board and Shared channel, without assignees or the internal channel. Guests never use a seat. Guests in shared teams are managed from that team.</p>
    <FormError message={guests.error ? errorMessage(guests.error) : act.error ? errorMessage(act.error) : null} />
    {guests.error ? <Button variant="secondary" onClick={() => void guests.refetch()}>Retry guests</Button> : null}
    {guests.isPending ? <p role="status">Loading guests…</p> : null}
    {canManage && !invitesBlocked ? <form className="flex flex-wrap gap-2" onSubmit={(event) => {
      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
      act.mutate(() => api.post(`/projects/${projectId}/guests`, { email: formText(data, 'email'), access: data.get('access') }), { onSuccess: () => form.reset() });
    }}>
      <Input name="email" type="email" required maxLength={254} aria-label="Guest email" placeholder="guest@example.com" className="min-w-0 flex-1" />
      <Select name="access" aria-label="Guest access" defaultValue="comment" className="w-auto"><option value="comment">Can comment</option><option value="read">Can view</option></Select>
      <Button type="submit" disabled={act.isPending}>Invite guest</Button>
    </form> : null}
    <ul className="divide-y divide-border" aria-label="Direct project guests">
      {(guests.data?.data ?? []).map((guest) => <li key={guest.userId} data-testid="guest-row" className="flex flex-wrap items-center gap-2 py-3">
        <Avatar person={{ id: guest.userId, ...guest }} size={28} />
        <div className="min-w-0 flex-1"><p className="truncate text-label font-medium">{guest.name}</p><p className="truncate text-caption text-muted-foreground">{guest.email}{guest.status === 'invited' ? ' · invited' : ''}</p></div>
        {canManage && !readOnly ? <>
          <Select aria-label={`Access for ${guest.name}`} value={guest.access} disabled={act.isPending} className="w-auto" onChange={(event) => { const value = event.target.value as GuestAccess; act.mutate(() => api.patch(`/projects/${projectId}/guests/${guest.userId}`, { access: value })); }}><option value="comment">Can comment</option><option value="read">Can view</option></Select>
          <Button variant="ghost" disabled={act.isPending} onClick={async () => {
            if (await confirm({ title: 'Revoke guest grant?', description: `${guest.name} will lose this direct grant. Access through a shared team is kept. Their comments and messages stay.`, confirmLabel: 'Revoke grant' })) act.mutate(() => api.del(`/projects/${projectId}/guests/${guest.userId}`));
          }}>Remove</Button>
        </> : <span className="text-label">{guest.access === 'comment' ? 'Can comment' : 'Can view'}</span>}
      </li>)}
    </ul>
    {guests.data && !guests.data.data.length ? <p className="text-label text-muted-foreground">No direct guest grants.</p> : null}
  </section>;
}
