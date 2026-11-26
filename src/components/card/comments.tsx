'use client';

import { LoadingSkeleton } from '@/components/skeleton';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from 'react';
import { AttachmentImage, AttachmentLink, Markdown } from '@/components/markdown';
import { useConfirm } from '@/components/confirmation';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Avatar, Button, GuestChip, LABEL_BG } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { cardPath } from '@/lib/cards';
import { applyComment } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { timeAgo } from '@/lib/time';
import { describeActivity } from '@/lib/card-activity';
import type { CardActivity, Comment, PersonRef } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { uploadCardAttachment } from './attachments';
import { useMentionCandidates } from './mention-input';
import type { RichEditorHandle } from './rich-editor';
import { ToolButton } from './tool-button';

type Thread = Comment & { replies: Comment[] };
const REPLY_COLLAPSE = 3;

export const VIEW_ONLY = 'You have view-only access to this project.';

/** The editor loads when the card opens; until then the box looks the same, one line tall. */
const RichEditor = dynamic(() => import('./rich-editor'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-10 px-3 py-2 text-body text-muted-foreground">Write a comment…</div>,
});

/** Something that happened on the card, for the Activity tab. Built from what the card read already returns. */
export interface ActivityEvent {
  id: string;
  at: string;
  person: Pick<PersonRef, 'id' | 'name'> & { avatarUrl?: string | null };
  text: ReactNode;
}

function useComments(cardId: string, projectId: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const comments = useQuery({
    queryKey: ['comments', cardId],
    // Cached flat so realtime events can patch single comments; grouped at render time.
    queryFn: async () => (await api.get<{ data: Thread[] }>(cardPath(cardId, projectId, '/comments'))).data.flatMap(({ replies, ...root }) => [root, ...replies]),
  });
  async function post(body: string, parentCommentId?: string, attachmentIds: string[] = []): Promise<boolean> {
    if (!body.trim()) return false;
    try {
      const c = await api.post<Comment>(cardPath(cardId, projectId, '/comments'), { body, ...(parentCommentId ? { parentCommentId } : {}), ...(attachmentIds.length ? { attachmentIds } : {}) });
      applyComment(qc, c);
      void qc.invalidateQueries({ queryKey: ['card', cardId] });
      return true;
    } catch (err) {
      toast(errorMessage(err));
      return false;
    }
  }
  return { comments, post };
}

/**
 * Card conversation (§3.3, AC19): Comments and, when `activity` is given, an Activity tab; then the
 * comment box, pinned to the bottom of the card while it scrolls. Comments post, edit, delete
 * (tombstone) and take one level of replies. `canPost = false` (a `read` guest, §3.6) swaps the box
 * for the view-only notice. Nothing is rendered until the server accepts a write, so a stale tab whose
 * access was lowered shows only the error (AC6).
 *
 * Returns siblings rather than one wrapper, so the pinned box sits directly in the scrolling column.
 */
export function Comments({ cardId, projectId, canPost = true, activity, inDrawer = false }: {
  cardId: string;
  projectId: string;
  canPost?: boolean;
  activity?: ActivityEvent[];
  /** In the card drawer the box spans the drawer's padding and pins to its very bottom. */
  inDrawer?: boolean;
}) {
  const { comments, post } = useComments(cardId, projectId);
  // The card's activity feed. An API without it (before migration 0019) answers 404: the tab then shows
  // what the card read returns, and comment files are linked from the text instead of posted with it.
  const feed = useQuery({
    queryKey: ['card', cardId, 'activity'],
    queryFn: async () => (await api.get<{ data: CardActivity[] }>(cardPath(cardId, projectId, '/activity'))).data,
    enabled: Boolean(activity),
    retry: false,
  });
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  const tabsId = useId();

  // Notification deep links land on the exact comment (AC19).
  const target = useSearchParams().get('comment');
  const loaded = comments.data !== undefined;
  useEffect(() => {
    if (target && loaded) document.getElementById(`comment-${target}`)?.scrollIntoView({ block: 'center' });
  }, [target, loaded]);

  const all = comments.data ?? [];
  const roots = all.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => all.filter((c) => c.parentCommentId === id);
  const live = all.filter((c) => !c.deletedAt);

  const list = (
    <>
      {comments.isPending ? <LoadingSkeleton variant="messages" className="p-4 sm:p-6" /> : null}
      {loaded && !roots.length ? <p className="text-label text-muted-foreground">No comments yet.</p> : null}
      <ol className="space-y-4">
        {roots.map((root) => (
          <li key={root.id}>
            <CommentItem comment={root} cardId={cardId} {...(canPost ? { onReply: (body: string) => post(body, root.id) } : {})} />
            <Replies replies={repliesOf(root.id)} cardId={cardId} />
          </li>
        ))}
      </ol>
    </>
  );

  return (
    <>
      <section aria-label="Comments" className="space-y-4">
        {activity ? (
          <>
            <div role="tablist" aria-label="Conversation" className="flex gap-1 border-b border-border">
              {(['comments', 'activity'] as const).map((name) => (
                <button key={name} type="button" role="tab" id={`${tabsId}-${name}`} aria-controls={`${tabsId}-${name}-panel`} aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={`tap -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-label font-medium ${tab === name ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                  {name === 'comments' ? 'Comments' : 'Activity'}
                  {name === 'comments' && live.length ? <span className="rounded-full bg-subtle px-1.5 text-caption tabular-nums text-muted-foreground">{live.length}</span> : null}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={`${tabsId}-${tab}`} className="space-y-4">
              {tab === 'comments' ? list : <Activity events={feed.data ? feed.data.map(toEvent) : activity} comments={live} />}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-secondary-foreground">Comments</h2>
            {list}
          </>
        )}
      </section>
      {canPost ? (
        <CommentComposer cardId={cardId} projectId={projectId} inDrawer={inDrawer} filesWithComment={feed.isSuccess} onPost={(body, attachmentIds) => post(body, undefined, attachmentIds)} onPosted={() => setTab('comments')} />
      ) : (
        <p data-testid="view-only" className="rounded-md bg-background px-3 py-2 text-sm text-secondary-foreground">
          {VIEW_ONLY}
        </p>
      )}
    </>
  );
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** An entry of the card's activity feed, as a line of the Activity tab. */
function toEvent(entry: CardActivity): ActivityEvent {
  return {
    id: `activity-${entry.id}`,
    at: entry.at,
    person: entry.actor ?? { id: 'deleted', name: 'Someone' },
    text: describeActivity(entry, shortDate).map((part, i) =>
      typeof part === 'string' ? part : (
        <span key={i} className="inline-flex items-center gap-1 font-medium text-foreground">
          {part.color ? <span aria-hidden="true" className={`size-2 rounded-full ${LABEL_BG[part.color] ?? 'bg-disabled-foreground'}`} /> : null}
          {part.name}
        </span>
      ),
    ),
  };
}

/** Everything that happened on the card, oldest first: the events given plus each comment. */
function Activity({ events, comments }: { events: ActivityEvent[]; comments: Comment[] }) {
  const now = useNow();
  const all = [
    ...events,
    ...comments.map((c) => ({ id: `comment-${c.id}`, at: c.createdAt, person: c.author, text: c.parentCommentId ? 'replied to a comment' : 'commented' })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol data-testid="card-activity" className="space-y-3">
      {all.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-label">
          <Avatar person={{ id: e.person.id, name: e.person.name, avatarUrl: e.person.avatarUrl ?? null }} size={22} />
          <p className="min-w-0 flex-1 pt-0.5 text-secondary-foreground">
            <span className="font-medium text-foreground">{e.person.name}</span> {e.text}
            <span className="ml-2 text-caption text-muted-foreground" title={new Date(e.at).toLocaleString()}>{timeAgo(e.at, now)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

interface Upload { key: number; name: string; progress: number }

/**
 * The comment box: one line until it is focused, then a formatting editor (full screen on phones)
 * with Attach. Files upload as the card's attachments and are linked from the comment.
 */
function CommentComposer({ cardId, projectId, inDrawer, filesWithComment, onPost, onPosted }: {
  cardId: string;
  projectId: string;
  inDrawer: boolean;
  /** The API posts files with the comment (`attachmentIds`); otherwise they are linked from the text. */
  filesWithComment: boolean;
  onPost: (body: string, attachmentIds: string[]) => Promise<boolean>;
  onPosted: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const people = useMentionCandidates();
  const editor = useRef<RichEditorHandle>(null);
  const file = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [files, setFiles] = useState<{ id: string; filename: string }[]>([]);
  const seq = useRef(0);

  async function submit() {
    if (!draft.trim() || busy || uploads.length) return;
    setBusy(true);
    if (await onPost(draft, files.map((f) => f.id))) { setDraft(''); setFiles([]); setExpanded(false); onPosted(); }
    setBusy(false);
  }

  async function attach(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      const key = ++seq.current;
      setUploads((u) => [...u, { key, name: f.name, progress: 0 }]);
      try {
        const id = await uploadCardAttachment(cardId, projectId, f, (progress) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress } : x))));
        if (filesWithComment) setFiles((list) => [...list, { id, filename: f.name }]);
        else editor.current?.insertAttachment(id, f.name);
      } catch (err) {
        toast(err instanceof ApiError && err.status === 413 ? `${f.name}: ${err.message}` : `${f.name}: ${errorMessage(err)}`);
      } finally {
        setUploads((u) => u.filter((x) => x.key !== key));
        void qc.invalidateQueries({ queryKey: ['card', cardId] });
      }
    }
    if (file.current) file.current.value = '';
  }

  function collapseIfEmpty(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget) && !draft.trim() && !uploads.length && !files.length) setExpanded(false);
  }

  /** An attached file not posted yet: taking it off deletes it from the card. */
  async function discard(id: string) {
    setFiles((list) => list.filter((f) => f.id !== id));
    try { await api.del(`/attachments/${id}`); } catch (err) { toast(errorMessage(err)); }
    void qc.invalidateQueries({ queryKey: ['card', cardId] });
  }

  return (
    // Sticky offsets are measured inside the scroll container's padding, so the drawer's box cancels it.
    <div data-testid="comment-composer" className={`sticky z-20 border-t border-border bg-surface py-3 ${inDrawer ? '-bottom-4 -mx-4 -mb-4 px-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6' : 'bottom-0'}`}>
      <div
        onBlur={collapseIfEmpty}
        className={expanded
          ? 'flex flex-col rounded-lg border border-ring bg-surface ring-2 ring-primary-border max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:rounded-none max-sm:border-0 max-sm:ring-0'
          : 'rounded-lg border border-input bg-surface hover:border-border-hover'}
      >
        {expanded ? (
          <div className="flex items-center justify-between border-b border-border px-3 py-2 sm:hidden">
            <p className="text-body font-semibold">Comment</p>
            <button type="button" aria-label="Close comment box" onClick={() => setExpanded(false)} className="tap inline-grid place-items-center rounded-md text-secondary-foreground hover:bg-subtle"><Icon name="close" /></button>
          </div>
        ) : null}
        <RichEditor
          ref={editor}
          value={draft}
          onChange={setDraft}
          onSubmit={() => void submit()}
          onFocus={() => setExpanded(true)}
          onEscape={() => { if (!draft.trim()) setExpanded(false); }}
          label="Write a comment"
          placeholder="Write a comment… use @ to mention"
          mentionable={people.data?.data ?? []}
          toolbar={expanded}
          actions={<ToolButton label="Attach files" icon="attachment" disabled={busy} onClick={() => file.current?.click()} />}
          className={expanded ? 'h-64 max-sm:h-auto max-sm:flex-1' : 'h-10 overflow-hidden'}
        />
        <input ref={file} type="file" multiple hidden aria-hidden="true" tabIndex={-1} onChange={(e) => void attach(e.target.files)} />
        {expanded ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-3 py-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {files.map((f) => (
              <span key={f.id} data-testid="pending-comment-file" className="inline-flex items-center gap-1 rounded-md border border-border bg-subtle py-0.5 pl-2 pr-0.5 text-caption text-secondary-foreground">
                <Icon name="attachment" className="size-3.5" />{f.filename}
                <button type="button" aria-label={`Remove ${f.filename}`} onClick={() => void discard(f.id)} className="tap inline-grid size-5 place-items-center rounded hover:bg-muted"><Icon name="close" className="size-3" /></button>
              </span>
            ))}
            {uploads.map((u) => (
              <span key={u.key} role="status" className="inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-caption text-secondary-foreground">
                <Icon name="attachment" className="size-3.5" />{u.name} · {u.progress}%
              </span>
            ))}
            <span className="mr-auto hidden text-caption text-muted-foreground sm:inline">⌘↵ to post</span>
            <Button variant="ghost" size="sm" onClick={() => { for (const f of files) void discard(f.id); setDraft(''); editor.current?.clear(); setExpanded(false); }}>Cancel</Button>
            <Button size="sm" onClick={() => void submit()} disabled={busy || !draft.trim() || uploads.length > 0}>Comment</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Replies({ replies, cardId }: { replies: Comment[]; cardId: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!replies.length) return null;
  const collapsed = replies.length > REPLY_COLLAPSE && !expanded;
  return (
    <div className="ml-9 mt-2 space-y-3 border-l-2 border-border-subtle pl-3">
      {collapsed ? (
        <button type="button" onClick={() => setExpanded(true)} className="tap text-sm font-medium text-primary">
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
  const confirmAction = useConfirm();
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
    if (!await confirmAction({ title: 'Delete comment?', description: 'This comment will be deleted. Replies remain in the conversation.', confirmLabel: 'Delete comment' })) return;
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
      className={`flex gap-2 rounded ${highlighted ? 'bg-warning-subtle ring-2 ring-warning-border' : ''}`}
    >
      <Avatar person={comment.author} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {/* Authors render by name only — no profile link, so deactivated members stay readable (AC8). */}
          <span className="font-semibold">{comment.author.name}</span>
          {comment.author.guest ? <span className="ml-1"><GuestChip /></span> : null}
          {!comment.author.active ? <span className="text-xs text-muted-foreground"> (deactivated)</span> : null}
          <span className="ml-2 text-xs text-muted-foreground" title={new Date(comment.createdAt).toLocaleString()}>
            {timeAgo(comment.createdAt, now)}
          </span>
          {comment.editedAt && !deleted ? <span className="ml-1 text-xs text-muted-foreground">(edited)</span> : null}
        </p>
        {deleted ? (
          <p data-testid="comment-tombstone" className="text-sm italic text-muted-foreground">
            This comment was deleted.
          </p>
        ) : editing ? (
          <InlineEditor value={editBody} onChange={setEditBody} onSubmit={() => void save()} onCancel={() => setEditing(false)} label="Edit comment" submitLabel="Save" />
        ) : (
          <>
            <Markdown source={comment.body ?? ''} />
            {comment.attachments?.length ? <CommentFiles files={comment.attachments} /> : null}
          </>
        )}
        {!deleted && !editing ? (
          <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
            {onReply ? (
              <button type="button" className="tap hover:text-foreground" onClick={() => setReplying((r) => !r)}>
                Reply
              </button>
            ) : null}
            {own ? (
              <>
                <button type="button" className="tap hover:text-foreground" onClick={() => { setEditBody(comment.body ?? ''); setEditing(true); }}>
                  Edit
                </button>
                <button type="button" className="tap hover:text-danger-text" onClick={() => void remove()}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {replying && onReply ? (
          <InlineEditor value={reply} onChange={setReply} onCancel={() => setReplying(false)} label="Write a reply" placeholder="Reply…" submitLabel="Reply"
            onSubmit={() => void onReply(reply).then((ok) => ok && (setReply(''), setReplying(false)))} />
        ) : null}
      </div>
    </article>
  );
}

/** The rich editor in a small box, for a reply or an edit. */
function InlineEditor({ value, onChange, onSubmit, onCancel, label, placeholder, submitLabel }: { value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void; label: string; placeholder?: string; submitLabel: string }) {
  const people = useMentionCandidates();
  return (
    <div className="mt-2 flex flex-col rounded-lg border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-primary-border">
      <RichEditor value={value} onChange={onChange} onSubmit={onSubmit} onEscape={onCancel} label={label} placeholder={placeholder} autoFocus mentionable={people.data?.data ?? []} className="max-h-72" />
      <div className="flex justify-end gap-2 border-t border-border-subtle px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onSubmit} disabled={!value.trim()}>{submitLabel}</Button>
      </div>
    </div>
  );
}

/** Files posted with a comment: images as previews, other files as download chips. */
function CommentFiles({ files }: { files: NonNullable<Comment['attachments']> }) {
  return (
    <ul data-testid="comment-files" className="mt-1.5 flex flex-wrap items-start gap-2">
      {files.map((f) => (
        <li key={f.id}>
          {f.mimeType?.startsWith('image/') && f.scanState === 'clean'
            ? <AttachmentLink id={f.id} plain><AttachmentImage src={`attachment:${f.id}`} alt={f.filename} /></AttachmentLink>
            : <AttachmentLink id={f.id}>{f.filename}</AttachmentLink>}
        </li>
      ))}
    </ul>
  );
}
