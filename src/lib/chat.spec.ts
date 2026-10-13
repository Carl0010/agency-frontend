import { addMessage, buildRows, deleteMessage, flattenPages, replySummary, throttle } from './chat';
import type { Message } from './types';

const person = (id: string) => ({ id, name: id.toUpperCase(), avatarUrl: null, active: true });
let seq = 0;
function msg(author: string, iso: string, extra: Partial<Message> = {}): Message {
  seq += 1;
  return {
    id: `m${seq}`,
    channelId: 'c',
    projectId: 'p',
    threadRootId: null,
    body: 'hi',
    author: person(author),
    mentionedUserIds: [],
    attachments: [],
    replyCount: 0,
    lastReplyAt: null,
    createdAt: iso,
    editedAt: null,
    deletedAt: null,
    ...extra,
  };
}

const now = new Date('2026-10-13T12:00:00');

describe('buildRows', () => {
  it('groups by author within 5 minutes and adds day dividers', () => {
    const rows = buildRows(
      [
        msg('a', '2026-10-12T09:00:00'),
        msg('a', '2026-10-12T09:03:00'),
        msg('a', '2026-10-12T09:09:00'),
        msg('b', '2026-10-12T09:10:00'),
        msg('b', '2026-10-13T09:10:00'),
      ],
      null,
      'a',
      now,
    );
    expect(rows.map((r) => (r.kind === 'message' ? `${r.message.author.id}${r.grouped ? '+' : ''}` : r.kind === 'day' ? r.label : r.kind))).toEqual([
      'Yesterday',
      'a',
      'a+',
      'a',
      'b',
      'Today',
      'b',
    ]);
  });

  it('places the New messages divider before the first message from someone else after the marker', () => {
    const rows = buildRows(
      [msg('b', '2026-10-13T09:00:00'), msg('a', '2026-10-13T09:05:00'), msg('b', '2026-10-13T09:06:00'), msg('b', '2026-10-13T09:07:00')],
      '2026-10-13T09:00:00',
      'a',
      now,
    );
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toEqual(['day', 'message', 'message', 'divider', 'message', 'message']);
    // The divider breaks grouping.
    const afterDivider = rows[4];
    expect(afterDivider?.kind === 'message' && afterDivider.grouped).toBe(false);
  });

  it('no divider when everything is read', () => {
    expect(buildRows([msg('b', '2026-10-13T09:00:00')], '2026-10-13T09:00:00', 'a', now).some((r) => r.kind === 'divider')).toBe(false);
  });
});

describe('page cache helpers', () => {
  it('flattens newest-first pages to oldest-first without duplicates; realtime adds once', () => {
    const a = msg('a', '2026-10-13T09:00:00');
    const b = msg('a', '2026-10-13T09:01:00');
    const c = msg('a', '2026-10-13T09:02:00');
    let data = { pages: [{ data: [c, b], nextCursor: 'x' }, { data: [b, a], nextCursor: null }], pageParams: [null, 'x'] };
    expect(flattenPages(data).map((m) => m.id)).toEqual([a.id, b.id, c.id]);
    const d = msg('b', '2026-10-13T09:03:00');
    data = addMessage(data, d)!;
    data = addMessage(data, d)!;
    expect(flattenPages(data).map((m) => m.id)).toEqual([a.id, b.id, c.id, d.id]);
    // Thread replies never land in the channel list.
    expect(flattenPages(addMessage(data, msg('b', '2026-10-13T09:04:00', { threadRootId: a.id }))).length).toBe(4);
    // Deleting a root without replies removes it; with replies keeps a tombstone.
    expect(flattenPages(deleteMessage(data, { ...d, deletedAt: 'x', body: null })).map((m) => m.id)).not.toContain(d.id);
    expect(flattenPages(deleteMessage(data, { ...a, deletedAt: 'x', body: null, replyCount: 2 })).find((m) => m.id === a.id)?.body).toBeNull();
  });

  it('reply summary', () => {
    expect(replySummary(1, '2m ago')).toBe('1 reply · last reply 2m ago');
    expect(replySummary(3, '2h ago')).toBe('3 replies · last reply 2h ago');
  });
});

describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires on the leading edge and once more on the trailing edge', () => {
    const calls: number[] = [];
    const t = throttle((n: number) => calls.push(n), 300);
    t(1);
    t(2);
    t(3);
    expect(calls).toEqual([1]);
    jest.advanceTimersByTime(300);
    expect(calls).toEqual([1, 3]);
  });
});
