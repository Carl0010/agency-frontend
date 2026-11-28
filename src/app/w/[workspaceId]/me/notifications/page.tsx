'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { PageHeader, Switch } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { DailySummarySetting, NotificationPreference } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/**
 * Calm notifications (API D-032): the daily summary switch, then the preferences grid (AC20):
 * each type × {in-app, email, push}. In-app is the feed and cannot be switched off; the column is
 * shown, locked on. By default only mentions and assignments push and nothing emails at once.
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

  const summaryKey = ['notification-daily-summary', ws.id] as const;
  // An API without the daily summary yet answers 404; the section then stays hidden.
  const summary = useQuery({
    queryKey: summaryKey,
    queryFn: () => api.get<{ data: DailySummarySetting }>(`/notifications/daily-summary?workspaceId=${ws.id}`),
    retry: false,
  });

  async function setSummary(enabled: boolean) {
    qc.setQueryData<{ data: DailySummarySetting }>(summaryKey, (old) => (old ? { data: { ...old.data, enabled } } : old));
    try {
      qc.setQueryData(summaryKey, await api.put<{ data: DailySummarySetting }>('/notifications/daily-summary', { workspaceId: ws.id, enabled }));
    } catch (err) {
      toast(errorMessage(err));
      void qc.invalidateQueries({ queryKey: summaryKey });
    }
  }

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
    <main className="ui-page">
      <PageHeader title="Notifications" description={`Choose how you hear about activity in ${ws.name}. Your inbox always shows everything. Anything you have not read reaches you once a day, not every few minutes.`} />
      {summary.data ? (
        <section className="mb-6 rounded-lg border border-border bg-surface p-4" aria-label="Daily summary" data-testid="daily-summary">
          <h2 className="mb-1 font-semibold">Daily summary</h2>
          <p className="mb-3 text-sm text-secondary-foreground">
            One email each morning at {localTime(summary.data.data.sendsAt)} ({summary.data.data.timezone}) with what you have not read yet. Nothing unread, no email.
          </p>
          <Switch checked={summary.data.data.enabled} onChange={(on) => void setSummary(on)} label="Email me a daily summary" />
        </section>
      ) : null}
      <h2 className="mb-1 font-semibold">Right away</h2>
      <p className="mb-3 text-sm text-secondary-foreground">
        By default only mentions and assignments push. Turn on email or push for anything you want the moment it happens; message and comment emails still wait 10 minutes in case you read them first.
      </p>
      {prefs.isPending ? (
        <LoadingSkeleton variant="form" />
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
                  <label className="tap inline-grid cursor-pointer place-items-center"><input type="checkbox" checked disabled aria-label={`${p.label} in-app (always on)`} className="size-4" /></label>
                </td>
                <td className="px-3 py-2 text-center">
                  <label className="tap inline-grid cursor-pointer place-items-center"><input type="checkbox" checked={p.email} onChange={() => void toggle(p, 'email')} aria-label={`${p.label} email`} className="size-4" /></label>
                </td>
                <td className="px-3 py-2 text-center">
                  <label className="tap inline-grid cursor-pointer place-items-center"><input type="checkbox" checked={p.push} onChange={() => void toggle(p, 'push')} aria-label={`${p.label} push`} className="size-4" /></label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

/** "08:00" as the reader's clock shows it, e.g. "8:00 AM". */
function localTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h ?? 8, m ?? 0).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
