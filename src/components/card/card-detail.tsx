'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { DuePill } from '@/components/due-pill';
import { Markdown } from '@/components/markdown';
import { useToast } from '@/components/toast';
import { Avatar, Button, LABEL_BG, Spinner } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { MentionScopeContext } from '@/lib/mention-scope';
import { applyTile, useProjectRealtime, useRoom } from '@/lib/realtime';
import { timeAgo, toLocalInput } from '@/lib/time';
import type { Board, CardDetail as Detail, CardTile, Label, Member, Page } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';
import { Attachments } from './attachments';
import { Checklists } from './checklists';
import { Comments } from './comments';

const LABEL_COLORS = ['grey', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown'] as const;

/** Card detail (§3.3). Rendered inside the board drawer and as a full page on hard load. */
export function CardDetail({ cardId, boardHref, layout = 'page' }: { cardId: string; boardHref: string; layout?: 'page' | 'drawer' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const card = useQuery({ queryKey: ['card', cardId], queryFn: () => api.get<Detail>(`/cards/${cardId}`) });
  useProjectRealtime(card.data?.projectId);
  // Being in card:{id} marks this card as "being viewed": comments on it arrive in-app, not as a push (§4.1).
  useRoom(card.data ? `card:${cardId}` : null, {});

  /** Runs a card mutation; a returned tile updates board + card caches immediately. */
  const mutate = async (fn: () => Promise<unknown>) => {
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'boardId' in res && 'listId' in res) applyTile(qc, res as CardTile);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      void qc.invalidateQueries({ queryKey: ['card', cardId] });
    }
  };

  if (card.isPending) return <Spinner />;
  if (card.error) {
    return <p className="p-8 text-center text-secondary-foreground">{card.error instanceof ApiError && card.error.status === 404 ? 'This card does not exist or you cannot see it.' : errorMessage(card.error)}</p>;
  }
  const c = card.data;
  const createdBy = (
    <p className="text-secondary-foreground">
      Created by <span className="font-medium text-foreground">{c.createdBy.name}</span>
      {!c.createdBy.active ? ' (deactivated)' : ''} · {timeAgo(c.createdAt, now)}
    </p>
  );
  const actions = (
    <>
      <MoveToList card={c} onMove={(listId) => mutate(() => api.patch<CardTile>(`/cards/${c.id}/move`, { listId, beforeCardId: null }))} />
      <div className="flex flex-wrap gap-2">
        {c.archivedAt ? null : (
          <Button variant="secondary" onClick={() => void mutate(() => api.post<CardTile>(`/cards/${c.id}/archive`))}>
            Archive
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard
              .writeText(`${window.location.origin}${boardHref}/c/${c.id}`)
              .then(() => toast('Link copied.', 'info'))
              .catch(() => toast('Could not copy the link.'));
          }}
        >
          Copy link
        </Button>
      </div>
    </>
  );

  return (
    <div className={`flex flex-col gap-6 ${layout === 'page' ? 'lg:flex-row' : ''}`} data-testid="card-detail">
      <div className={`min-w-0 space-y-6 ${layout === 'page' ? 'lg:w-[65%]' : ''}`}>
        {c.archivedAt ? (
          <div role="status" className="flex items-center justify-between rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-text">
            This card is archived.
            <Button variant="secondary" onClick={() => void mutate(() => api.post<CardTile>(`/cards/${c.id}/restore`))}>
              Restore
            </Button>
          </div>
        ) : null}
        <header>
          <p className="text-xs text-muted-foreground">
            <span>{c.listName}</span> · <span data-testid="card-key">{c.key}-{c.number}</span>
          </p>
          <Title card={c} onSave={(title) => mutate(() => api.patch<CardTile>(`/cards/${c.id}`, { title }))} />
        </header>

        {layout === 'drawer' ? <div className="space-y-3 rounded-lg border border-border bg-background p-3 text-sm">{actions}</div> : null}

        <div className={`flex gap-y-4 ${layout === 'drawer' ? 'flex-col border-b border-border pb-6' : 'flex-wrap gap-x-8'}`}>
          <Field label="Assignees">
            <Assignees card={c} onToggle={(userId, on) => mutate(() => (on ? api.post<CardTile>(`/cards/${c.id}/assignees/${userId}`) : api.del<CardTile>(`/cards/${c.id}/assignees/${userId}`)))} />
          </Field>
          <Field label="Labels">
            <Labels card={c} onToggle={(labelId, on) => mutate(() => (on ? api.post<CardTile>(`/cards/${c.id}/labels/${labelId}`) : api.del<CardTile>(`/cards/${c.id}/labels/${labelId}`)))} />
          </Field>
          <Field label="Due">
            <Due card={c} now={now} onSave={(patch) => mutate(() => api.patch<CardTile>(`/cards/${c.id}`, patch))} />
          </Field>
        </div>

        <MentionScopeContext.Provider value={{ projectId: c.projectId, surface: 'card' }}>
          <Description card={c} onSave={(description) => mutate(() => api.patch<CardTile>(`/cards/${c.id}`, { description }))} />
          <Checklists cardId={c.id} checklists={c.checklists} />
          <Attachments cardId={c.id} attachments={c.attachments} />
          <Comments cardId={c.id} />
        </MentionScopeContext.Provider>
        {layout === 'drawer' ? <div className="border-t border-border pt-4 text-caption">{createdBy}</div> : null}
      </div>

      {layout === 'page' ? <aside className="space-y-4 text-sm lg:w-[35%]">{createdBy}{actions}</aside> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Title({ card, onSave }: { card: Detail; onSave: (title: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={card.title}
        aria-label="Card title"
        maxLength={500}
        onBlur={(e) => {
          setEditing(false);
          const t = e.target.value.trim();
          if (t && t !== card.title) void onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
          }
        }}
        className="mt-1 w-full rounded border border-ring px-1 text-xl font-semibold"
      />
    );
  }
  return (
    <h1 className="mt-1 text-xl font-semibold">
      <button type="button" onClick={() => setEditing(true)} className="tap w-full break-words text-left hover:bg-background" data-testid="card-title">
        {card.title}
      </button>
    </h1>
  );
}

function Popover({ label, children }: { label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="tap flex h-7 w-7 items-center justify-center rounded-full bg-subtle text-secondary-foreground hover:bg-muted">
        +
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-md border border-border bg-surface p-2 shadow-lg" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function Assignees({ card, onToggle }: { card: Detail; onToggle: (userId: string, on: boolean) => Promise<void> }) {
  const ws = useWorkspace();
  const members = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`) });
  const assignable = (members.data?.data ?? []).filter((m) => m.status === 'active' && m.role !== 'guest');
  const assigned = new Set(card.assignees.map((a) => a.id));
  return (
    <div className="flex items-center gap-1">
      {card.assignees.map((a) => (
        <Avatar key={a.id} person={a} size={28} />
      ))}
      <Popover label="Assign members">
        {() => (
          <ul className="space-y-0.5">
            {assignable.map((m) => (
              <li key={m.userId}>
                <label className="tap flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-background">
                  <input type="checkbox" checked={assigned.has(m.userId)} onChange={(e) => void onToggle(m.userId, e.target.checked)} />
                  <Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={22} />
                  {m.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </div>
  );
}

function Labels({ card, onToggle }: { card: Detail; onToggle: (labelId: string, on: boolean) => Promise<void> }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const labels = useQuery({ queryKey: ['labels', ws.id], queryFn: () => api.get<Page<Label>>(`/workspaces/${ws.id}/labels`) });
  const on = new Set(card.labels.map((l) => l.id));

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const label = await api.post<Label>(`/workspaces/${ws.id}/labels`, { name: form.get('name'), color: form.get('color') });
      await qc.invalidateQueries({ queryKey: ['labels', ws.id] });
      formEl.reset();
      await onToggle(label.id, true);
    } catch (err) {
      toast(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {card.labels.map((l) => (
        <span key={l.id} className="inline-flex items-center gap-1.5 rounded bg-subtle px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          <span aria-hidden="true" className={`size-2 rounded-full ${LABEL_BG[l.color] ?? 'bg-disabled-foreground'}`} />{l.name}
        </span>
      ))}
      <Popover label="Edit labels">
        {() => (
          <div className="space-y-2">
            <ul className="space-y-0.5">
              {(labels.data?.data ?? []).map((l) => (
                <li key={l.id}>
                  <label className="tap flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-background">
                    <input type="checkbox" checked={on.has(l.id)} onChange={(e) => void onToggle(l.id, e.target.checked)} />
                    <span className={`h-3 w-3 rounded-full ${LABEL_BG[l.color] ?? 'bg-disabled-foreground'}`} />
                    {l.name}
                  </label>
                </li>
              ))}
            </ul>
            <form onSubmit={(e) => void create(e)} className="flex gap-1 border-t border-border-subtle pt-2">
              <input name="name" required maxLength={60} placeholder="New label" aria-label="New label name" className="min-w-0 flex-1 rounded border border-input px-1 text-sm" />
              <select name="color" aria-label="Label colour" defaultValue="blue" className="rounded border border-input text-sm">
                {LABEL_COLORS.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-primary px-2 text-sm text-primary-foreground">
                Add
              </button>
            </form>
          </div>
        )}
      </Popover>
    </div>
  );
}

function Due({ card, now, onSave }: { card: Detail; now: Date; onSave: (patch: { dueAt?: string | null; dueCompletedAt?: string | null }) => Promise<void> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
      <input
        type="datetime-local"
        aria-label="Due date"
        defaultValue={toLocalInput(card.dueAt)}
        key={card.dueAt ?? 'none'}
        onBlur={(e) => {
          const v = e.target.value ? new Date(e.target.value).toISOString() : null;
          if (v !== card.dueAt) void onSave({ dueAt: v });
        }}
        className="tap rounded-md border border-input px-1 py-0.5 text-sm"
      />
      {card.dueAt ? (
        <>
          <label className="tap flex items-center gap-1 text-sm">
            <input type="checkbox" checked={card.dueCompletedAt !== null} onChange={(e) => void onSave({ dueCompletedAt: e.target.checked ? new Date().toISOString() : null })} />
            Done
          </label>
          <button type="button" className="tap text-xs text-muted-foreground underline" onClick={() => void onSave({ dueAt: null, dueCompletedAt: null })}>
            Remove
          </button>
        </>
      ) : null}
    </div>
  );
}

function Description({ card, onSave }: { card: Detail; onSave: (d: string | null) => Promise<void> }) {
  const draftKey = `agency:draft:desc:${card.id}`;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    // A draft left in localStorage reopens the editor so a closed tab loses nothing (§3.3).
    const saved = localStorage.getItem(draftKey);
    if (saved !== null && saved !== (card.description ?? '')) {
      setText(saved);
      setEditing(true);
    }
  }, [draftKey, card.description]);

  const begin = () => {
    setText(localStorage.getItem(draftKey) ?? card.description ?? '');
    setEditing(true);
  };
  const close = () => {
    localStorage.removeItem(draftKey);
    setEditing(false);
  };
  const save = async () => {
    await onSave(text.trim() ? text : null);
    close();
  };

  return (
    <section aria-label="Description" className="space-y-1">
      <h2 className="text-sm font-semibold text-secondary-foreground">Description</h2>
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            rows={8}
            value={text}
            aria-label="Description"
            maxLength={50_000}
            onChange={(e) => {
              setText(e.target.value);
              localStorage.setItem(draftKey, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void save();
              }
              if (e.key === 'Escape') e.stopPropagation();
            }}
            className="w-full rounded-md border border-input p-2 font-mono text-sm focus:border-ring focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => void save()}>Save</Button>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground">Markdown · ⌘↵ to save</span>
          </div>
        </div>
      ) : card.description ? (
        <div role="button" tabIndex={0} onClick={begin} onKeyDown={(e) => e.key === 'Enter' && begin()} className="tap cursor-text rounded p-1 hover:bg-background" data-testid="description">
          <Markdown source={card.description} />
        </div>
      ) : (
        <button type="button" onClick={begin} className="tap w-full rounded-md bg-background p-3 text-left text-sm text-muted-foreground hover:bg-subtle">
          Add a description…
        </button>
      )}
    </section>
  );
}

function MoveToList({ card, onMove }: { card: Detail; onMove: (listId: string) => Promise<void> }) {
  const board = useQuery({ queryKey: ['board', card.boardId], queryFn: () => api.get<Board>(`/boards/${card.boardId}`) });
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">List</span>
      <select
        value={card.listId}
        aria-label="Move to list"
        onChange={(e) => void onMove(e.target.value)}
        className="tap w-full rounded-md border border-input bg-surface px-2 py-1 text-sm"
      >
        {(board.data?.lists ?? [{ id: card.listId, name: card.listName }]).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
