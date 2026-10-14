'use client';

import { useState } from 'react';
import { Markdown } from '@/components/markdown';
import { useToast } from '@/components/toast';
import { Avatar, Button, GuestChip } from '@/components/ui';
import { MentionInput } from '@/components/card/mention-input';
import { api, errorMessage } from '@/lib/api';
import { replySummary } from '@/lib/chat';
import { formatBytes, timeAgo } from '@/lib/time';
import type { Message, MessageAttachment } from '@/lib/types';

function AttachmentList({ attachments }: { attachments: MessageAttachment[] }) {
  const toast = useToast();
  if (attachments.length === 0) return null;
  async function download(a: MessageAttachment) {
    try {
      const { url } = await api.get<{ url: string }>(`/attachments/${a.id}/content?format=url`);
      window.location.assign(url);
    } catch (err) {
      toast(errorMessage(err));
    }
  }
  return (
    <ul className="mt-1 flex flex-wrap gap-2">
      {attachments.map((a) => {
        const ready = a.uploaded && a.scanState === 'clean';
        const status = !a.uploaded ? 'Uploading…' : a.scanState === 'pending' ? 'Scanning…' : a.scanState === 'blocked' ? 'Blocked' : formatBytes(a.sizeBytes);
        return (
          <li key={a.id} data-testid="message-attachment" className={`flex max-w-xs items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs ${ready ? '' : 'opacity-60'}`}>
            <span aria-hidden>📄</span>
            {ready ? (
              <button type="button" onClick={() => void download(a)} className="min-w-0 truncate text-blue-700 hover:underline">
                {a.filename}
              </button>
            ) : (
              <span className="min-w-0 truncate">{a.filename}</span>
            )}
            <span className="shrink-0 text-slate-500">{status}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One chat message (§3.4): avatar + name + time unless grouped, Markdown body,
 * `(edited)`, tombstone once deleted, attachments, the reply summary on roots,
 * and hover actions — Reply in thread, Edit (own), Delete (own/admin), Copy link.
 */
export function MessageItem({
  message,
  grouped,
  now,
  myId,
  isAdmin,
  highlighted,
  inThread = false,
  onOpenThread,
  linkFor,
}: {
  message: Message;
  grouped: boolean;
  now: Date;
  myId: string | null;
  isAdmin: boolean;
  highlighted: boolean;
  inThread?: boolean;
  onOpenThread?: (rootId: string) => void;
  linkFor: (m: Message) => string;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? '');
  const mine = message.author.id === myId;
  const deleted = message.deletedAt !== null;

  async function saveEdit() {
    const body = draft.trim();
    if (!body || body === message.body) {
      setEditing(false);
      return;
    }
    try {
      await api.patch(`/messages/${message.id}`, { body });
      setEditing(false);
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove() {
    if (!window.confirm('Delete this message?')) return;
    try {
      await api.del(`/messages/${message.id}`);
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${linkFor(message)}`);
      toast('Link copied', 'info');
    } catch {
      toast('Could not copy the link.');
    }
  }

  return (
    <div
      id={`message-${message.id}`}
      data-testid="message"
      data-message-id={message.id}
      className={`group relative flex gap-2 px-3 ${grouped ? 'py-0.5' : 'pt-2 pb-0.5'} ${highlighted ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
    >
      <div className="w-8 shrink-0">{grouped ? null : <Avatar person={message.author} size={32} />}</div>
      <div className="min-w-0 flex-1">
        {grouped ? null : (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{message.author.name}</span>
            {message.author.guest ? <GuestChip /> : null}
            <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()} className="text-xs text-slate-500">
              {timeAgo(message.createdAt, now)}
            </time>
          </div>
        )}
        {deleted ? (
          <p className="text-sm italic text-slate-400" data-testid="message-tombstone">
            Message deleted
          </p>
        ) : editing ? (
          <div className="space-y-1 py-1">
            <MentionInput value={draft} onChange={setDraft} onSubmit={() => void saveEdit()} label="Edit message" enterToSend autoFocus rows={2} />
            <div className="flex gap-2">
              <Button onClick={() => void saveEdit()}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div data-testid="message-body">
            <Markdown source={message.body ?? ''} />
            {message.editedAt ? <span className="text-xs text-slate-400">(edited)</span> : null}
          </div>
        )}
        {deleted ? null : <AttachmentList attachments={message.attachments} />}
        {!inThread && message.replyCount > 0 && onOpenThread ? (
          <button type="button" data-testid="reply-summary" onClick={() => onOpenThread(message.id)} className="mt-0.5 text-xs font-medium text-blue-700 hover:underline">
            {replySummary(message.replyCount, message.lastReplyAt ? timeAgo(message.lastReplyAt, now) : '')}
          </button>
        ) : null}
      </div>
      {deleted || editing ? null : (
        <div className="absolute -top-3 right-3 hidden gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm group-focus-within:flex group-hover:flex" role="toolbar" aria-label="Message actions">
          {!inThread && onOpenThread ? (
            <button type="button" className="rounded px-2 py-1 hover:bg-slate-100" onClick={() => onOpenThread(message.id)}>
              Reply in thread
            </button>
          ) : null}
          {mine ? (
            <button type="button" className="rounded px-2 py-1 hover:bg-slate-100" onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : null}
          {mine || isAdmin ? (
            <button type="button" className="rounded px-2 py-1 text-red-700 hover:bg-red-50" onClick={() => void remove()}>
              Delete
            </button>
          ) : null}
          <button type="button" className="rounded px-2 py-1 hover:bg-slate-100" onClick={() => void copyLink()}>
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
