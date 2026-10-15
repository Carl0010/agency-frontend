'use client';

import { Icon } from '@/components/icon';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { putWithProgress } from '@/components/card/attachments';
import { MentionInput } from '@/components/card/mention-input';
import { useToast } from '@/components/toast';
import { api, ApiError, errorMessage } from '@/lib/api';
import { throttle } from '@/lib/chat';
import { emit } from '@/lib/realtime';
import type { Message } from '@/lib/types';

interface UploadTicket {
  attachmentId: string;
  upload: { method: 'PUT'; url: string; headers: Record<string, string> };
}

/**
 * Chat composer (§3.4): Markdown, `@` mentions, drag-to-attach, `↵` sends and
 * `⇧↵` adds a newline. Keystrokes emit a throttled typing signal (AC6).
 * Files ride the card presigned flow: the message is posted first, then each
 * file is uploaded to it (AC2).
 */
export function Composer({
  channelId,
  threadRootId,
  label,
  placeholder,
  onSent,
}: {
  channelId: string;
  threadRootId: string | null;
  label: string;
  placeholder: string;
  onSent?: (m: Message) => void;
}) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const draftKey = `draft:${channelId}:${threadRootId ?? 'root'}`;

  // A closed tab does not lose a half-written message.
  useEffect(() => {
    setBody(window.localStorage.getItem(draftKey) ?? '');
  }, [draftKey]);
  useEffect(() => {
    if (body) window.localStorage.setItem(draftKey, body);
    else window.localStorage.removeItem(draftKey);
  }, [body, draftKey]);

  const typing = useMemo(() => throttle(() => emit('typing', { channelId, threadRootId }), 300), [channelId, threadRootId]);
  useEffect(() => () => typing.cancel(), [typing]);

  async function send() {
    const text = body.trim() || (files.length ? files.map((f) => `📎 ${f.name}`).join('\n') : '');
    if (!text || sending) return;
    setSending(true);
    typing.cancel();
    try {
      const path = threadRootId ? `/messages/${threadRootId}/thread` : `/channels/${channelId}/messages`;
      const m = await api.post<Message>(path, { body: text });
      setBody('');
      const queued = files;
      setFiles([]);
      onSent?.(m);
      for (const f of queued) {
        try {
          const ticket = await api.post<UploadTicket>(`/channels/${channelId}/messages/${m.id}/attachments`, {
            filename: f.name,
            mimeType: f.type || 'application/octet-stream',
            sizeBytes: f.size,
          });
          await putWithProgress(ticket.upload.url, f, ticket.upload.headers, () => undefined);
          await api.post(`/attachments/${ticket.attachmentId}/complete`);
        } catch (err) {
          toast(err instanceof ApiError && err.status === 413 ? `${f.name}: ${err.message}` : `${f.name}: ${errorMessage(err)}`);
        }
      }
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`border-t border-border bg-surface p-2 ${over ? 'ring-2 ring-primary-border' : ''}`}
    >
      {files.length ? (
        <ul className="mb-1 flex flex-wrap gap-1 text-xs">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1 rounded bg-subtle px-2 py-0.5">
              <Icon name="attachment" /> {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} className="text-muted-foreground">
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <MentionInput value={body} onChange={setBody} onSubmit={() => void send()} label={label} placeholder={placeholder} enterToSend rows={2} onTyping={typing} />
        </div>
        <button type="button" aria-label="Attach files" onClick={() => input.current?.click()} className="tap rounded px-2 text-muted-foreground hover:bg-subtle">
          <Icon name="attachment" />
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || (!body.trim() && files.length === 0)}
          className="tap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:bg-primary-border"
        >
          Send
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          aria-label="Choose files"
          onChange={(e) => {
            setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

/** "Dana is typing…" — each entry clears 5s after that person's last keystroke signal (AC6). */
export function useTyping(myId: string | null) {
  const [typers, setTypers] = useState<Record<string, { name: string; until: number; threadRootId: string | null }>>({});
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setTypers((all) => {
        const live = Object.entries(all).filter(([, v]) => v.until > now);
        return live.length === Object.keys(all).length ? all : Object.fromEntries(live);
      });
    }, 250);
    return () => clearInterval(t);
  }, []);
  return {
    onTyping: (e: { user: { id: string; name: string }; threadRootId: string | null }) => {
      if (e.user.id === myId) return;
      setTypers((all) => ({ ...all, [e.user.id]: { name: e.user.name, until: Date.now() + 5000, threadRootId: e.threadRootId } }));
    },
    /** A posted message ends that person's indicator immediately. */
    onMessage: (authorId: string) =>
      setTypers((all) => {
        if (!all[authorId]) return all;
        const next = { ...all };
        delete next[authorId];
        return next;
      }),
    names: (threadRootId: string | null) =>
      Object.values(typers)
        .filter((t) => t.threadRootId === threadRootId)
        .map((t) => t.name),
  };
}

export function TypingLine({ names }: { names: string[] }) {
  const text =
    names.length === 0
      ? ''
      : names.length === 1
        ? `${names[0]} is typing…`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing…`
          : 'Several people are typing…';
  return (
    <p aria-live="polite" data-testid="typing-indicator" className="h-5 px-3 text-xs text-muted-foreground">
      {text}
    </p>
  );
}
