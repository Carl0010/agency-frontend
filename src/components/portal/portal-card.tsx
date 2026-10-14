'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Comments } from '@/components/card/comments';
import { DuePill } from '@/components/due-pill';
import { Markdown } from '@/components/markdown';
import { useToast } from '@/components/toast';
import { LABEL_BG, Spinner } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { MentionScopeContext } from '@/lib/mention-scope';
import { useProjectRealtime, useRoom } from '@/lib/realtime';
import { formatBytes } from '@/lib/time';
import type { Attachment, CardDetail, Checklist, PortalProject } from '@/lib/types';
import { useNow } from '@/lib/use-now';

/**
 * Guest card detail (§3.6): title, description, due date, labels, checklists
 * (read-only, progress visible), downloadable attachments, and the comment
 * thread — with the composer only for `access = 'comment'`. No assignees: the
 * payload does not carry them (AC9).
 */
export function PortalCard({ project, cardId }: { project: PortalProject; cardId: string }) {
  const now = useNow();
  const card = useQuery({ queryKey: ['card', cardId], queryFn: () => api.get<CardDetail>(`/cards/${cardId}`) });
  useProjectRealtime(project.id);
  useRoom(card.data ? `card:${cardId}` : null, {});

  const back = (
    <Link href={`/portal/${project.id}`} className="tap inline-flex items-center text-sm text-blue-700">
      ← Board
    </Link>
  );
  if (card.isPending) return <Spinner />;
  if (card.error) {
    return (
      <div className="p-8 text-center text-slate-600">
        <p>{card.error instanceof ApiError && card.error.status === 404 ? 'This card does not exist or you cannot see it.' : errorMessage(card.error)}</p>
        {back}
      </div>
    );
  }
  const c = card.data;

  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl space-y-6 p-4" data-testid="portal-card-detail">
        {back}
        <header>
          <p className="text-xs text-slate-500">
            {c.listName} · {c.key}-{c.number}
          </p>
          <h1 className="text-xl font-semibold break-words">{c.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {c.labels.map((l) => (
              <span key={l.id} className={`rounded px-2 py-0.5 text-xs font-medium text-white ${LABEL_BG[l.color] ?? 'bg-slate-400'}`}>
                {l.name}
              </span>
            ))}
            <DuePill dueAt={c.dueAt} dueCompletedAt={c.dueCompletedAt} now={now} />
          </div>
        </header>
        {c.description ? (
          <section aria-label="Description">
            <h2 className="mb-1 text-sm font-semibold text-slate-700">Description</h2>
            <Markdown source={c.description} />
          </section>
        ) : null}
        {c.checklists.map((k) => (
          <ReadOnlyChecklist key={k.id} checklist={k} />
        ))}
        {c.attachments.length ? <ReadOnlyAttachments attachments={c.attachments} /> : null}
        <MentionScopeContext.Provider value={{ projectId: project.id, surface: 'card' }}>
          <Comments cardId={c.id} canPost={project.access === 'comment'} />
        </MentionScopeContext.Provider>
      </article>
    </div>
  );
}

function ReadOnlyChecklist({ checklist }: { checklist: Checklist }) {
  const done = checklist.items.filter((i) => i.doneAt).length;
  const total = checklist.items.length;
  return (
    <section aria-label={checklist.title} data-testid="portal-checklist">
      <h2 className="text-sm font-semibold text-slate-700">
        {checklist.title}{' '}
        <span className="font-normal text-slate-500">
          {done}/{total}
        </span>
      </h2>
      <div className="mt-1 h-1.5 rounded bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-1.5 rounded bg-green-600" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
      </div>
      <ul className="mt-2 space-y-1">
        {checklist.items.map((i) => (
          <li key={i.id} className="flex items-start gap-2 text-sm">
            <span aria-hidden>{i.doneAt ? '☑' : '☐'}</span>
            <span className={i.doneAt ? 'text-slate-500 line-through' : ''}>{i.text}</span>
            <span className="sr-only">{i.doneAt ? '(done)' : '(not done)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReadOnlyAttachments({ attachments }: { attachments: Attachment[] }) {
  const toast = useToast();
  async function open(a: Attachment) {
    try {
      const { url } = await api.get<{ url: string }>(`/attachments/${a.id}/content?format=url`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast(errorMessage(err));
    }
  }
  return (
    <section aria-label="Attachments">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Attachments</h2>
      <ul className="space-y-1">
        {attachments.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              disabled={a.kind === 'file' && a.scanState !== 'clean'}
              onClick={() => void open(a)}
              className="tap text-left text-sm text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline"
            >
              {a.filename}
              {a.sizeBytes ? <span className="ml-1 text-xs text-slate-500">{formatBytes(a.sizeBytes)}</span> : null}
              {a.kind === 'file' && a.scanState !== 'clean' ? <span className="ml-1 text-xs">Scanning…</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
