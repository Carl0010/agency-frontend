'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast';
import { Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useUserEvent } from '@/lib/realtime';
import { timeAgo } from '@/lib/time';
import type { AppNotification, NotificationFeed, NotificationType } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';

const ICON: Record<NotificationType, string> = {
  mention: '@',
  assignment: '👤',
  due_soon: '⏰',
  due_now: '⏰',
  new_message: '💬',
  thread_reply: '↩',
};

/**
 * `/w/[slug]/inbox` (AC19): newest first, unread styling, mark one / mark all
 * read, and a deep link per type that lands on the exact card, comment or
 * message (the API pre-renders each link into the notification payload).
 */
export default function InboxPage() {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const now = useNow();
  const key = ['notifications', ws.id, 'feed'] as const;
  const feed = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      api.get<NotificationFeed>(`/notifications?workspaceId=${ws.id}${pageParam ? `&cursor=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['notifications', ws.id] });
  useUserEvent('notification.created', refresh);
  useUserEvent('notification.read', refresh);

  async function markRead(body: { ids: string[] } | { before: string }) {
    try {
      await api.post('/notifications/read', { workspaceId: ws.id, ...body });
    } catch (err) {
      toast(errorMessage(err));
    }
    refresh();
  }

  function open(n: AppNotification) {
    if (!n.readAt) void markRead({ ids: [n.id] });
    router.push(n.url);
  }

  const items = feed.data?.pages.flatMap((p) => p.data) ?? [];
  const unread = feed.data?.pages[0]?.unreadCount ?? 0;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold">Inbox</h1>
        {unread ? <span className="rounded-full bg-red-100 px-2 text-xs font-medium text-red-800">{unread} unread</span> : null}
        <div className="ml-auto flex gap-2">
          <Link href={`/w/${ws.slug}/settings/notifications`} className="tap flex items-center px-2 text-sm text-slate-600 hover:underline">
            Preferences
          </Link>
          <Button variant="secondary" disabled={!unread} onClick={() => void markRead({ before: new Date().toISOString() })}>
            Mark all read
          </Button>
        </div>
      </div>
      {feed.isPending ? (
        <Spinner />
      ) : feed.error ? (
        <p className="text-slate-600">{errorMessage(feed.error)}</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nothing here yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white" aria-label="Notifications">
          {items.map((n) => (
            <li key={n.id} data-testid="notification" data-unread={n.readAt ? 'false' : 'true'} className={`flex items-start gap-3 px-3 py-2 ${n.readAt ? '' : 'bg-blue-50/60'}`}>
              <span aria-hidden className="mt-0.5 w-5 shrink-0 text-center">
                {ICON[n.type]}
              </span>
              <a
                href={n.url}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  open(n);
                }}
                className="min-w-0 flex-1"
              >
                <span className={`block truncate text-sm ${n.readAt ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</span>
                <span className="block truncate text-sm text-slate-600">{n.body}</span>
                <span className="block truncate text-xs text-slate-500">
                  {n.context} · {timeAgo(n.createdAt, now)}
                </span>
              </a>
              {n.readAt ? null : (
                <button
                  type="button"
                  aria-label={`Mark "${n.title}" read`}
                  onClick={() => void markRead({ ids: [n.id] })}
                  className="tap shrink-0 rounded px-2 text-xs text-blue-700 hover:bg-blue-100"
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {feed.hasNextPage ? (
        <div className="mt-3 text-center">
          <Button variant="secondary" disabled={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
            Load more
          </Button>
        </div>
      ) : null}
    </main>
  );
}
