'use client';

import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ProjectRail, ProjectTabs } from '@/components/project-chrome';
import { Avatar, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { addMessage, buildRows, deleteMessage, flattenPages, replaceMessage } from '@/lib/chat';
import { useRoom } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import type { Channel, ChannelKind, Member, Message, Page, Project } from '@/lib/types';
import { channelsKey } from '@/lib/unread';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';
import { Composer, TypingLine, useTyping } from './composer';
import { MessageItem } from './message-item';

type Pages = InfiniteData<Page<Message>, string | null>;
type Thread = { root: Message; replies: Message[] };

const messagesKey = (channelId: string) => ['messages', channelId] as const;
const threadKey = (rootId: string) => ['thread', rootId] as const;

/**
 * §3.4 client channel (`kind = client`) and Team channel (`kind = internal`):
 * message list oldest→newest with day dividers and author grouping, the "New
 * messages" line at the read marker, infinite scroll upwards that keeps the
 * viewport still, a right-hand thread pane, typing indicators, and realtime.
 */
export function ChannelScreen({ projectId, kind }: { projectId: string; kind: ChannelKind }) {
  const ws = useWorkspace();
  const { user } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = useNow();
  const [railOpen, setRailOpen] = useState(false);
  const threadId = params.get('thread');
  const target = params.get('m');

  const project = useQuery({ queryKey: ['project', projectId], queryFn: () => api.get<Project>(`/projects/${projectId}`) });
  const channels = useQuery({
    queryKey: ['project-channels', projectId],
    queryFn: () => api.get<{ data: Channel[] }>(`/projects/${projectId}/channels`),
  });
  const members = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });
  const channel = channels.data?.data.find((c) => c.kind === kind) ?? null;
  const channelId = channel?.id ?? null;

  const messages = useInfiniteQuery({
    queryKey: messagesKey(channelId ?? 'none'),
    queryFn: ({ pageParam }) => api.get<Page<Message>>(`/channels/${channelId}/messages${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(channelId),
    staleTime: Infinity,
  });

  // The divider is pinned where the marker was when the channel opened, so it
  // does not jump away while the user reads (AC5).
  const [dividerAt, setDividerAt] = useState<{ channelId: string; at: string | null } | null>(null);
  useEffect(() => {
    if (channel && dividerAt?.channelId !== channel.id) setDividerAt({ channelId: channel.id, at: channel.lastReadMessageAt });
  }, [channel, dividerAt]);

  const typing = useTyping(user?.id ?? null);
  const list = useMemo(() => flattenPages(messages.data), [messages.data]);
  const rows = useMemo(() => buildRows(list, dividerAt?.at ?? null, user?.id ?? null, now), [list, dividerAt, user, now]);

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const stickToBottom = useRef(false);

  useRoom(
    channelId ? `channel:${channelId}` : null,
    {
      'message.created': (p: { message: Message }) => {
        const m = p.message;
        typing.onMessage(m.author.id);
        if (m.threadRootId) {
          qc.setQueryData<Thread>(threadKey(m.threadRootId), (t) => (t && !t.replies.some((r) => r.id === m.id) ? { ...t, replies: [...t.replies, m] } : t));
          return;
        }
        if (atBottom.current || m.author.id === user?.id) stickToBottom.current = true;
        qc.setQueryData<Pages>(messagesKey(m.channelId), (d) => addMessage(d, m));
      },
      'message.updated': (p: { message: Message }) => {
        const m = p.message;
        qc.setQueryData<Pages>(messagesKey(m.channelId), (d) => replaceMessage(d, m));
        if (m.threadRootId) {
          qc.setQueryData<Thread>(threadKey(m.threadRootId), (t) => (t ? { ...t, replies: t.replies.map((r) => (r.id === m.id ? m : r)) } : t));
        } else {
          qc.setQueryData<Thread>(threadKey(m.id), (t) => (t ? { ...t, root: m } : t));
        }
      },
      'message.deleted': (p: { message: Message }) => {
        const m = p.message;
        qc.setQueryData<Pages>(messagesKey(m.channelId), (d) => deleteMessage(d, m));
        if (m.threadRootId) {
          qc.setQueryData<Thread>(threadKey(m.threadRootId), (t) => (t ? { ...t, replies: t.replies.map((r) => (r.id === m.id ? m : r)) } : t));
        } else {
          qc.setQueryData<Thread>(threadKey(m.id), (t) => (t ? { ...t, root: m } : t));
        }
      },
      'presence.typing': (p: { user: { id: string; name: string }; threadRootId: string | null }) => typing.onTyping(p),
    },
    // Anything missed while disconnected comes back with a refetch.
    () => {
      if (channelId) void qc.invalidateQueries({ queryKey: messagesKey(channelId) });
    },
  );

  // ---------------------------------------------------------------------------
  // Read marker: advance to the newest message while the user can see it.
  // ---------------------------------------------------------------------------
  const lastMarked = useRef<string | null>(null);
  const markRead = useCallback(() => {
    if (!channelId || document.visibilityState !== 'visible' || !atBottom.current) return;
    const newest = list[list.length - 1];
    if (!newest || newest.createdAt === lastMarked.current) return;
    if (channel?.lastReadMessageAt && Date.parse(channel.lastReadMessageAt) >= Date.parse(newest.createdAt)) return;
    lastMarked.current = newest.createdAt;
    void api
      .post<Channel>(`/channels/${channelId}/read`, { lastReadMessageAt: newest.createdAt })
      .then((c) => {
        qc.setQueryData<{ data: Channel[] }>(['project-channels', projectId], (old) => (old ? { data: old.data.map((x) => (x.id === c.id ? c : x)) } : old));
        qc.setQueryData<{ data: Channel[] }>(channelsKey(ws.id), (old) => (old ? { data: old.data.map((x) => (x.id === c.id ? c : x)) } : old));
      })
      .catch(() => {
        lastMarked.current = null;
      });
  }, [channelId, list, channel, qc, projectId, ws.id]);
  useEffect(() => {
    markRead();
    const onVisible = () => markRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  // ---------------------------------------------------------------------------
  // Scrolling: initial position, stick-to-bottom, and older pages without a jump (AC3)
  // ---------------------------------------------------------------------------
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const positioned = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !channelId || !messages.data) return;
    if (anchor.current) {
      // Older messages were prepended above: keep the same message under the eye.
      el.scrollTop = anchor.current.top + (el.scrollHeight - anchor.current.height);
      anchor.current = null;
      return;
    }
    if (positioned.current !== channelId) {
      positioned.current = channelId;
      const focus = target ? document.getElementById(`message-${target}`) : el.querySelector('[data-testid="new-messages-divider"]');
      if (focus) focus.scrollIntoView({ block: 'center' });
      else el.scrollTop = el.scrollHeight;
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      return;
    }
    if (stickToBottom.current) {
      stickToBottom.current = false;
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      markRead();
    }
  }, [messages.data, channelId, target, markRead]);

  const loadOlder = useCallback(() => {
    const el = scroller.current;
    if (!el || !messages.hasNextPage || messages.isFetchingNextPage) return;
    anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    void messages.fetchNextPage();
  }, [messages]);

  // A deep link to an older message pages back until it is loaded.
  useEffect(() => {
    if (!target || !messages.data || messages.isFetchingNextPage) return;
    if (list.some((m) => m.id === target)) {
      document.getElementById(`message-${target}`)?.scrollIntoView({ block: 'center' });
      return;
    }
    if (messages.hasNextPage && messages.data.pages.length < 40) loadOlder();
  }, [target, list, messages.data, messages.hasNextPage, messages.isFetchingNextPage, loadOlder]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && positioned.current) loadOlder();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadOlder]);

  const openThread = (rootId: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('thread', rootId);
    next.delete('m');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const closeThread = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('thread');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (project.isPending || channels.isPending) return <Spinner />;
  if (project.error || channels.error) return <p className="p-8 text-center text-slate-600">{errorMessage(project.error ?? channels.error)}</p>;
  if (!channel) return <p className="p-8 text-center text-slate-600">This channel does not exist.</p>;

  const isAdmin = ws.role === 'owner' || ws.role === 'admin';
  const tab = kind === 'client' ? 'chat' : 'team';
  const linkFor = (m: Message) =>
    m.threadRootId ? `/w/${ws.slug}/p/${projectId}/${tab}?thread=${m.threadRootId}&m=${m.id}` : `/w/${ws.slug}/p/${projectId}/${tab}?m=${m.id}`;
  const people = (members.data?.data ?? []).filter((m) => m.status === 'active');

  return (
    <div className="flex h-full">
      <ProjectRail open={railOpen} onClose={() => setRailOpen(false)} currentProjectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <button type="button" aria-label="Projects" onClick={() => setRailOpen(true)} className="tap rounded px-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            ☰
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{project.data.name}</h1>
            {project.data.clientName ? <p className="truncate text-xs text-slate-500">{project.data.clientName}</p> : null}
          </div>
          <div className="ml-2">
            <ProjectTabs projectId={projectId} boardId={project.data.defaultBoardId} current={kind} />
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <section aria-label={`${channel.name} channel`} className={`flex min-w-0 flex-1 flex-col ${threadId ? 'hidden md:flex' : 'flex'}`}>
            <header className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-2">
              <h2 className="font-semibold" data-testid="channel-name">
                {channel.name}
              </h2>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${kind === 'client' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
                data-testid="channel-badge"
              >
                {kind === 'client' ? 'Client' : 'Internal'}
              </span>
              <div className="ml-auto flex -space-x-1.5">
                {people.slice(0, 6).map((m) => (
                  <Avatar key={m.userId} person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={24} />
                ))}
              </div>
            </header>
            {kind === 'client' ? (
              <p className="border-b border-emerald-100 bg-emerald-50 px-3 py-1 text-xs text-emerald-900" data-testid="client-reminder">
                Your client can read and post here.
              </p>
            ) : null}
            <div
              ref={scroller}
              data-testid="message-list"
              onScroll={(e) => {
                const el = e.currentTarget;
                const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                if (bottom && !atBottom.current) {
                  atBottom.current = true;
                  markRead();
                } else atBottom.current = bottom;
              }}
              className="min-h-0 flex-1 overflow-y-auto pb-2"
            >
              <div ref={sentinel} className="h-1" />
              {messages.isFetchingNextPage ? <p className="py-2 text-center text-xs text-slate-500">Loading earlier messages…</p> : null}
              {!messages.hasNextPage && messages.data ? (
                <p className="px-3 py-4 text-center text-xs text-slate-400">This is the start of {channel.name}.</p>
              ) : null}
              {messages.isPending ? <Spinner /> : null}
              {rows.map((r) =>
                r.kind === 'day' ? (
                  <div key={r.key} className="my-2 flex items-center gap-2 px-3 text-xs font-medium text-slate-500">
                    <span className="h-px flex-1 bg-slate-200" />
                    {r.label}
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                ) : r.kind === 'divider' ? (
                  <div key={r.key} data-testid="new-messages-divider" className="my-1 flex items-center gap-2 px-3 text-xs font-semibold text-red-600">
                    <span className="h-px flex-1 bg-red-300" />
                    New messages
                  </div>
                ) : (
                  <MessageItem
                    key={r.key}
                    message={r.message}
                    grouped={r.grouped}
                    now={now}
                    myId={user?.id ?? null}
                    isAdmin={isAdmin}
                    highlighted={r.message.id === target}
                    onOpenThread={openThread}
                    linkFor={linkFor}
                  />
                ),
              )}
            </div>
            <TypingLine names={typing.names(null)} />
            <Composer
              channelId={channel.id}
              threadRootId={null}
              label={`Message ${channel.name}`}
              placeholder={`Message ${channel.name}`}
              onSent={(m) => {
                stickToBottom.current = true;
                qc.setQueryData<Pages>(messagesKey(m.channelId), (d) => addMessage(d, m));
              }}
            />
          </section>
          {threadId ? (
            <ThreadPane
              rootId={threadId}
              channelId={channel.id}
              now={now}
              isAdmin={isAdmin}
              target={target}
              typingNames={typing.names(threadId)}
              linkFor={linkFor}
              onClose={closeThread}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Right-hand thread pane (§3.4), not a modal, so the channel stays visible; full-screen below 768px. */
function ThreadPane({
  rootId,
  channelId,
  now,
  isAdmin,
  target,
  typingNames,
  linkFor,
  onClose,
}: {
  rootId: string;
  channelId: string;
  now: Date;
  isAdmin: boolean;
  target: string | null;
  typingNames: string[];
  linkFor: (m: Message) => string;
  onClose: () => void;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const thread = useQuery({ queryKey: threadKey(rootId), queryFn: () => api.get<Thread>(`/messages/${rootId}/thread`) });
  const end = useRef<HTMLDivElement>(null);
  const count = thread.data?.replies.length ?? 0;
  useEffect(() => {
    if (target) document.getElementById(`message-${target}`)?.scrollIntoView({ block: 'center' });
    else end.current?.scrollIntoView({ block: 'end' });
  }, [count, target]);

  return (
    <aside aria-label="Thread" data-testid="thread-pane" className="flex w-full flex-col border-l border-slate-200 bg-white md:w-96 md:shrink-0">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <h2 className="font-semibold">Thread</h2>
        <button type="button" aria-label="Close thread" onClick={onClose} className="tap rounded px-2 text-slate-500 hover:bg-slate-100">
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {thread.isPending ? (
          <Spinner />
        ) : thread.error ? (
          <p className="p-4 text-sm text-slate-600">{errorMessage(thread.error)}</p>
        ) : (
          <>
            <MessageItem message={thread.data.root} grouped={false} now={now} myId={user?.id ?? null} isAdmin={isAdmin} highlighted={false} inThread linkFor={linkFor} />
            <p className="border-y border-slate-100 px-3 py-1 text-xs text-slate-500">
              {count} {count === 1 ? 'reply' : 'replies'}
            </p>
            {thread.data.replies.map((r) => (
              <MessageItem key={r.id} message={r} grouped={false} now={now} myId={user?.id ?? null} isAdmin={isAdmin} highlighted={r.id === target} inThread linkFor={linkFor} />
            ))}
            <div ref={end} />
          </>
        )}
      </div>
      <TypingLine names={typingNames} />
      {thread.data && !thread.data.root.deletedAt ? (
        <Composer
          channelId={channelId}
          threadRootId={rootId}
          label="Reply in thread"
          placeholder="Reply…"
          onSent={(m) => qc.setQueryData<Thread>(threadKey(rootId), (t) => (t && !t.replies.some((r) => r.id === m.id) ? { ...t, replies: [...t.replies, m] } : t))}
        />
      ) : null}
    </aside>
  );
}
