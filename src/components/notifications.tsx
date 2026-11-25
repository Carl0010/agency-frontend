'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Icon } from './icon';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { countSession, dismissExplainer, enablePush, explainerDismissed, pushSupported, subscribeThisBrowser } from '@/lib/push';
import { useUserEvent } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import type { NotificationFeed } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

export const unreadKey = (workspaceId: string) => ['notifications', workspaceId, 'unread-count'] as const;

/** Module-rail inbox with the unread count; live via `notification.created` / `notification.read`. */
export function NotificationBell({ active, onNavigate }: { active?: boolean; onNavigate?: () => void }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const count = useQuery({
    queryKey: unreadKey(ws.id),
    queryFn: () => api.get<NotificationFeed>(`/notifications?workspaceId=${ws.id}&unread=true&limit=1`),
    select: (d) => d.unreadCount,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['notifications', ws.id] });
  useUserEvent('notification.created', refresh);
  useUserEvent('notification.read', refresh);
  const n = count.data ?? 0;
  return (
    <Link
      href={`/w/${ws.id}/inbox`}
      aria-label={n ? `Inbox, ${n} unread` : 'Inbox'}
      data-testid="notification-bell"
      aria-current={active ? 'location' : undefined}
      onClick={onNavigate}
      className="ui-module-link tap relative"
      title={n ? `Inbox, ${n} unread` : 'Inbox'}
    >
      <Icon name="inbox" className="size-5" /><span className="sr-only">Inbox</span>
      {n ? (
        <span data-testid="unread-badge" className="absolute right-1 top-1 min-w-4 rounded-full bg-primary px-1 text-center text-caption font-semibold leading-4 text-primary-foreground">
          {n > 99 ? '99+' : n}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The only place the browser permission prompt is ever requested (AC16): an
 * in-app explainer, shown from a user's second session onwards, never on
 * first load. Once granted, later sessions re-register silently.
 */
export function PushExplainer() {
  const { user } = useSession();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !pushSupported()) return;
    const sessions = countSession(user.id);
    if (Notification.permission === 'granted') {
      void subscribeThisBrowser().catch(() => undefined);
      return;
    }
    setShow(sessions >= 2 && Notification.permission === 'default' && !explainerDismissed(user.id));
  }, [user]);

  if (!show || !user) return null;
  return (
    // One slim row: the message, Turn on, and a close button.
    <div role="region" aria-label="Enable notifications" data-testid="push-explainer" className="flex items-center gap-2 border-b border-primary-border bg-primary-subtle px-3 py-1.5 text-label text-primary-text sm:px-4">
      <Icon name="bell" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1" title="Notifications arrive even when Agency is closed.">Get notified when you’re mentioned or assigned a card.</span>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void enablePush()
            .catch(() => 'default')
            .finally(() => {
              setBusy(false);
              setShow(false);
            });
        }}
        className="tap shrink-0 rounded-md bg-primary px-3 py-1 text-label font-medium text-primary-foreground"
      >
        Turn on
      </button>
      <button
        type="button"
        onClick={() => {
          dismissExplainer(user.id);
          setShow(false);
        }}
        aria-label="Not now"
        title="Not now"
        className="tap inline-grid shrink-0 place-items-center rounded-md p-1 text-primary-text hover:bg-primary-muted"
      >
        <Icon name="close" className="size-4" />
      </button>
    </div>
  );
}
