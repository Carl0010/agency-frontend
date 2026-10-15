'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { NotificationPreference } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/**
 * Preferences grid (AC20): 6 types × {in-app, email, push}. In-app is the feed
 * and cannot be switched off; the column is shown, locked on.
 */
export default function NotificationSettingsPage() {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['notification-prefs', ws.id] as const;
  const prefs = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ data: NotificationPreference[] }>(`/notifications/preferences?workspaceId=${ws.id}`),
  });

  async function toggle(p: NotificationPreference, channel: 'email' | 'push') {
    const next = { ...p, [channel]: !p[channel] };
    qc.setQueryData<{ data: NotificationPreference[] }>(key, (old) => (old ? { data: old.data.map((x) => (x.type === p.type ? next : x)) } : old));
    try {
      const saved = await api.put<{ data: NotificationPreference[] }>('/notifications/preferences', {
        workspaceId: ws.id,
        preferences: [{ type: p.type, email: next.email, push: next.push }],
      });
      qc.setQueryData(key, saved);
    } catch (err) {
      toast(errorMessage(err));
      void qc.invalidateQueries({ queryKey: key });
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4">
      <h1 className="mb-1 text-xl font-semibold">Notifications</h1>
      <p className="mb-4 text-sm text-secondary-foreground">
        Choose how you hear about activity in {ws.name}. Your inbox always shows everything; message and comment emails only go out if
        you have not read them within 10 minutes.
      </p>
      {prefs.isPending ? (
        <Spinner />
      ) : prefs.error ? (
        <p className="text-secondary-foreground">{errorMessage(prefs.error)}</p>
      ) : (
        <table className="w-full overflow-hidden rounded-md border border-border bg-surface text-sm" data-testid="preferences-grid">
          <thead className="bg-background text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2 text-center">In-app</th>
              <th className="px-3 py-2 text-center">Email</th>
              <th className="px-3 py-2 text-center">Push</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {prefs.data.data.map((p) => (
              <tr key={p.type} data-testid={`pref-${p.type}`}>
                <td className="px-3 py-2">{p.label}</td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked disabled aria-label={`${p.label} in-app (always on)`} className="size-4" />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={p.email} onChange={() => void toggle(p, 'email')} aria-label={`${p.label} email`} className="size-4" />
                </td>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" checked={p.push} onChange={() => void toggle(p, 'push')} aria-label={`${p.label} push`} className="size-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
