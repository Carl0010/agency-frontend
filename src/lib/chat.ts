import type { InfiniteData } from '@tanstack/react-query';
import type { Message, Page } from './types';

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'divider'; key: string }
  | { kind: 'message'; key: string; message: Message; grouped: boolean };

const GROUP_WINDOW_MS = 5 * 60_000;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Oldest→newest messages into render rows (§3.4): day dividers, a single
 * "New messages" line before the first message from someone else after the
 * read marker, and author grouping within a 5-minute window.
 */
export function buildRows(messages: Message[], lastReadAt: string | null, myId: string | null, now: Date): ChatRow[] {
  const rows: ChatRow[] = [];
  let prev: Message | null = null;
  let dividerPlaced = false;
  const marker = lastReadAt ? Date.parse(lastReadAt) : null;
  for (const m of messages) {
    let breakGroup = false;
    if (!prev || dayKey(prev.createdAt) !== dayKey(m.createdAt)) {
      rows.push({ kind: 'day', key: `day:${dayKey(m.createdAt)}`, label: dayLabel(m.createdAt, now) });
      breakGroup = true;
    }
    if (!dividerPlaced && marker !== null && m.author.id !== myId && Date.parse(m.createdAt) > marker) {
      rows.push({ kind: 'divider', key: 'divider' });
      dividerPlaced = true;
      breakGroup = true;
    }
    const grouped =
      !breakGroup &&
      prev !== null &&
      prev.author.id === m.author.id &&
      !prev.deletedAt &&
      !m.deletedAt &&
      Date.parse(m.createdAt) - Date.parse(prev.createdAt) < GROUP_WINDOW_MS;
    rows.push({ kind: 'message', key: m.id, message: m, grouped });
    prev = m;
  }
  return rows;
}

/** Pages are newest-first; the view is oldest→newest with no duplicates. */
export function flattenPages(data: InfiniteData<Page<Message>> | undefined): Message[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: Message[] = [];
  for (const page of data.pages) {
    for (const m of page.data) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out.reverse();
}

type Pages = InfiniteData<Page<Message>, string | null>;

/** A realtime channel-level message lands at the head of the newest page (once). */
export function addMessage(data: Pages | undefined, m: Message): Pages | undefined {
  if (!data || m.threadRootId) return data;
  if (data.pages.some((p) => p.data.some((x) => x.id === m.id))) return replaceMessage(data, m);
  const [first, ...rest] = data.pages;
  if (!first) return data;
  return { ...data, pages: [{ ...first, data: [m, ...first.data] }, ...rest] };
}

export function replaceMessage(data: Pages | undefined, m: Message): Pages | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map((x) => (x.id === m.id ? m : x)) })) };
}

/** A deleted root stays as a tombstone only while replies hang off it. */
export function deleteMessage(data: Pages | undefined, m: Message): Pages | undefined {
  if (!data) return data;
  if (m.replyCount > 0) return replaceMessage(data, m);
  return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.filter((x) => x.id !== m.id) })) };
}

/** "3 replies · last reply 2h ago" (AC4). */
export function replySummary(count: number, lastReplyAgo: string): string {
  return `${count} ${count === 1 ? 'reply' : 'replies'} · last reply ${lastReplyAgo}`;
}

/** Throttle with leading and trailing calls: the last keystroke is always sent within `ms`. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number): ((...args: A) => void) & { cancel: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  const run = (args: A) => {
    last = Date.now();
    fn(...args);
  };
  const throttled = (...args: A) => {
    const wait = ms - (Date.now() - last);
    if (wait <= 0) {
      run(args);
      return;
    }
    pending = args;
    timer ??= setTimeout(() => {
      timer = null;
      if (pending) run(pending);
      pending = null;
    }, wait);
  };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return throttled;
}
