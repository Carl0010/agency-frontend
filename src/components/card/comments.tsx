'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Markdown } from '@/components/markdown';
import { useToast } from '@/components/toast';
import { Avatar, Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { applyComment } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { timeAgo } from '@/lib/time';
import type { Comment } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { MentionInput } from './mention-input';

type Thread = Comment & { replies: Comment[] };
const REPLY_COLLAPSE = 3;

/** Card comment thread (§3.3, AC19): post, edit, delete (tombstone), one level of replies. */
export function Comments({ cardId }: { cardId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const comments = useQuery({
    queryKey: ['comments', cardId],
    // Cached flat so realtime events can patch single comments; grouped at render time.
    queryFn: async () => (await api.get<{ data: Thread[] }>(`/cards/${cardId}/comments`)).data.flatMap(({ replies, ...root }) => [root, ...replies]),
  });

  async function post(body: string, parentCommentId?: string): Promise<boolean> {
    if (!body.trim()) return false;
    try {
      const c = await api.post<Comment>(`/cards/${cardId}/comments`, { body, ...(parentCommentId ? { parentCommentId } : {}) });
      applyComment(qc, c);
      void qc.invalidateQueries({ queryKey: ['card', cardId] });
      return true;
    } catch (err) {
      toast(errorMessage(err));
      return false;
    }
  }

  async function submitRoot() {
    setBusy(true);
    if (await post(draft)) setDraft('');
    setBusy(false);
  }

  // Notification deep links land on the exact comment (AC19).
  const target = useSearchParams().get('comment');
  const loaded = comments.data !== undefined;
  useEffect(() => {
    if (target && loaded) document.getElementById(`comment-${target}`)?.scrollIntoView({ block: 'center' });
  }, [target, loaded]);

  const all = comments.data ?? [];
  const roots = all.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => all.filter((c) => c.parentCommentId === id);

  return (
    <section aria-label="Comments" className="space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Comments</h2>
      {comments.isPending ? <Spinner /> : null}
      <ol className="space-y-4">
        {roots.map((root) => (
          <li key={root.id}>
            <CommentItem comment={root} cardId={cardId} onReply={(body) => post(body, root.id)} />
            <Replies replies={repliesOf(root.id)} cardId={cardId} />
          </li>
        ))}
      </ol>
      <div className="space-y-2">
        <MentionInput value={draft} onChange={setDraft} onSubmit={() => void submitRoot()} placeholder="Write a comment… use @ to mention" label="Write a comment" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Markdown supported · ⌘↵ to post</span>
          <Button onClick={() => void submitRoot()} disabled={busy || !draft.trim()}>
            Comment
          </Button>
        </div>
      </div>
    </section>
  );
}

function Replies({ replies, cardId }: { replies: Comment[]; cardId: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!replies.length) return null;
  const collapsed = replies.length > REPLY_COLLAPSE && !expanded;
  return (
    <div className="ml-9 mt-2 space-y-3 border-l-2 border-slate-100 pl-3">
      {collapsed ? (
        <button type="button" onClick={() => setExpanded(true)} className="tap text-sm font-medium text-blue-700">
          {replies.length} replies
        </button>
      ) : (
        replies.map((r) => <CommentItem key={r.id} comment={r} cardId={cardId} />)
      )}
    </div>
  );
}

function CommentItem({ comment, cardId, onReply }: { comment: Comment; cardId: string; onReply?: (body: string) => Promise<boolean> }) {
  const highlighted = useSearchParams().get('comment') === comment.id;
  const { user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body ?? '');
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const own = comment.author.id === user?.id;
  const deleted = comment.deletedAt !== null;

  async function save() {
    try {
      applyComment(qc, await api.patch<Comment>(`/comments/${comment.id}`, { body: editBody }));
      setEditing(false);
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  async function remove() {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.del(`/comments/${comment.id}`);
      applyComment(qc, { ...comment, body: null, deletedAt: new Date().toISOString(), mentionedUserIds: [] });
      void qc.invalidateQueries({ queryKey: ['card', cardId] });
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <article
      id={`comment-${comment.id}`}
      data-testid="comment"
      data-comment-id={comment.id}
      className={`flex gap-2 rounded ${highlighted ? 'bg-amber-50 ring-2 ring-amber-200' : ''}`}
    >
      <Avatar person={comment.author} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {/* Authors render by name only — no profile link, so deactivated members stay readable (AC8). */}
          <span className="font-semibold">{comment.author.name}</span>
          {!comment.author.active ? <span className="text-xs text-slate-500"> (deactivated)</span> : null}
          <span className="ml-2 text-xs text-slate-500" title={new Date(comment.createdAt).toLocaleString()}>
            {timeAgo(comment.createdAt, now)}
          </span>
          {comment.editedAt && !deleted ? <span className="ml-1 text-xs text-slate-500">(edited)</span> : null}
        </p>
        {deleted ? (
          <p data-testid="comment-tombstone" className="text-sm italic text-slate-400">
            This comment was deleted.
          </p>
        ) : editing ? (
          <div className="mt-1 space-y-2">
            <MentionInput value={editBody} onChange={setEditBody} onSubmit={() => void save()} autoFocus label="Edit comment" />
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={!editBody.trim()}>Save</Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Markdown source={comment.body ?? ''} />
        )}
        {!deleted && !editing ? (
          <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
            {onReply ? (
              <button type="button" className="tap hover:text-slate-800" onClick={() => setReplying((r) => !r)}>
                Reply
              </button>
            ) : null}
            {own ? (
              <>
                <button type="button" className="tap hover:text-slate-800" onClick={() => { setEditBody(comment.body ?? ''); setEditing(true); }}>
                  Edit
                </button>
                <button type="button" className="tap hover:text-red-700" onClick={() => void remove()}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {replying && onReply ? (
          <div className="mt-2 space-y-2">
            <MentionInput
              value={reply}
              onChange={setReply}
              autoFocus
              label="Write a reply"
              placeholder="Reply…"
              onSubmit={() => void onReply(reply).then((ok) => ok && (setReply(''), setReplying(false)))}
            />
            <div className="flex gap-2">
              <Button onClick={() => void onReply(reply).then((ok) => ok && (setReply(''), setReplying(false)))} disabled={!reply.trim()}>
                Reply
              </Button>
              <Button variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
