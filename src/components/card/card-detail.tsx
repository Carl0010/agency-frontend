'use client';

import { CardSkeleton } from '@/components/skeleton';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DuePill } from '@/components/due-pill';
import { Icon } from '@/components/icon';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { ArrivalChip } from '@/components/arrival';
import { ReplanAction } from '@/components/arrival-actions';
import { Markdown } from '@/components/markdown';
import { useToast } from '@/components/toast';
import { Avatar, Button, Checkbox, Field as FormField, Input, LABEL_BG, MultiCombobox, Select } from '@/components/ui';
import { Dialog, DialogActions } from '@/components/ui-dialog';
import { FormError } from '@/components/auth-card';
import { api, errorMessage } from '@/lib/api';
import { MentionScopeContext } from '@/lib/mention-scope';
import { applyTile, useProjectRealtime, useRoom } from '@/lib/realtime';
import { timeAgo, toLocalInput } from '@/lib/time';
import type { Board, CardDetail as Detail, CardTile, Label, Page } from '@/lib/types';
import { useNow } from '@/lib/use-now';
import { useWorkspace } from '@/lib/workspace';
import { cardDetailKey, cardPath, cardRef, useCardPeople } from '@/lib/cards';
import { cardUrl } from '@/lib/card-url';
import { ProjectError } from '@/components/projects/project-error';
import { Attachments } from './attachments';
import { CardPlacements, PlaceCardDialog } from './card-placements';
import { Checklists } from './checklists';
import { Comments } from './comments';

const LABEL_COLORS = ['grey', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown'] as const;

/**
 * Card detail (§3.3). Rendered inside the board drawer and as a full page with full=true. Opened in
 * the URL's project: a card can be in several (docs/CARD_PLACEMENTS.md in the API repository). When
 * the person cannot see it there, the API shows it in a project they can, and the URL follows.
 */
export function CardDetail({ cardId, projectId, boardHref, layout = 'page' }: { cardId: string; projectId: string; boardHref: string; layout?: 'page' | 'drawer' }) {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const ws = useWorkspace();
  const router = useRouter();
  const card = useQuery({ queryKey: cardDetailKey(cardId, projectId), queryFn: () => api.get<Detail>(cardPath(cardId, projectId)) });
  const shownProject = card.data?.projectId;
  const shownBoard = card.data?.boardId;
  useEffect(() => {
    if (shownProject && shownBoard && shownProject !== projectId) router.replace(cardUrl(ws.id, { projectId: shownProject, boardId: shownBoard }, cardId, window.location.search), { scroll: false });
  }, [shownProject, shownBoard, projectId, cardId, ws.id, router]);
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

  if (card.isPending) return <CardSkeleton />;
  if (card.error) {
    return <ProjectError error={card.error} retry={() => void card.refetch()} />;
  }
  const c = card.data;
  const createdBy = (
    <p className="text-secondary-foreground">
      Created by <span className="font-medium text-foreground">{c.createdBy.name}</span>
      {!c.createdBy.active ? ' (deactivated)' : ''} · {timeAgo(c.createdAt, now)}
    </p>
  );
  const copyLink = () => {
    void navigator.clipboard
      .writeText(`${window.location.origin}${boardHref}/c/${c.id}${new URLSearchParams(window.location.search).get('full') === 'true' ? '?full=true' : ''}`)
      .then(() => toast('Link copied.', 'info'))
      .catch(() => toast('Could not copy the link.'));
  };

  return (
    <div className={`flex flex-col gap-6 ${layout === 'page' ? 'lg:flex-row' : ''}`} data-testid="card-detail">
      <div className={`min-w-0 space-y-6 ${layout === 'page' ? 'lg:w-[65%]' : ''}`}>
        {c.archivedAt ? (
          <div role="status" className="flex items-center justify-between rounded-md bg-warning-subtle px-3 py-2 text-sm text-warning-text">
            This card is archived.
            <Button variant="secondary" onClick={() => void mutate(() => api.post<CardTile>(cardPath(c.id, c.projectId, '/restore')))}>
              Restore
            </Button>
          </div>
        ) : null}
        <header>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
              <span>{c.listName}</span> · <span data-testid="card-key">{cardRef(c)}</span>
            </p>
            <CardActionsMenu card={c} onArchive={() => void mutate(() => api.post<CardTile>(cardPath(c.id, c.projectId, '/archive')))} onCopyLink={copyLink} />
          </div>
          <Title card={c} onSave={(title) => mutate(() => api.patch<CardTile>(cardPath(c.id, c.projectId), { title }))} />
          <ArrivalChip boardId={c.boardId} cardId={c.id} />
          <ReplanAction boardId={c.boardId} projectId={c.projectId} cardId={c.id} title={c.title} />
        </header>

        {/* Properties as label/value rows; the card's actions are in the ⋯ menu above. */}
        <div data-testid="card-properties" className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 border-b border-border pb-5 text-label">
          <Field label="List">
            <MoveToList card={c} onMove={(listId) => mutate(() => api.patch<CardTile>(`/cards/${c.id}/move`, { listId, beforeCardId: null }))} />
          </Field>
          <Field label="Assignees">
            <Assignees card={c} onToggle={(userId, on) => mutate(() => (on ? api.post<CardTile>(cardPath(c.id, c.projectId, `/assignees/${userId}`)) : api.del<CardTile>(cardPath(c.id, c.projectId, `/assignees/${userId}`))))} />
          </Field>
          <Field label="Labels">
            <Labels card={c} onToggle={(labelId, on) => mutate(() => (on ? api.post<CardTile>(cardPath(c.id, c.projectId, `/labels/${labelId}`)) : api.del<CardTile>(cardPath(c.id, c.projectId, `/labels/${labelId}`))))} />
          </Field>
          <Field label="Due">
            <Due card={c} now={now} onSave={(patch) => mutate(() => api.patch<CardTile>(cardPath(c.id, c.projectId), patch))} />
          </Field>
          {c.placements?.length ? (
            <Field label="Projects" top>
              <CardPlacements card={c} />
            </Field>
          ) : null}
        </div>

        <MentionScopeContext.Provider value={{ projectId: c.projectId, surface: 'card', cardId: c.id }}>
          <Description card={c} onSave={(description) => mutate(() => api.patch<CardTile>(cardPath(c.id, c.projectId), { description }))} />
          <Checklists cardId={c.id} projectId={c.projectId} checklists={c.checklists} />
          <Attachments cardId={c.id} projectId={c.projectId} attachments={c.attachments} />
          <Comments cardId={c.id} projectId={c.projectId} />
        </MentionScopeContext.Provider>
        {layout === 'drawer' ? <div className="border-t border-border pt-4 text-caption">{createdBy}</div> : null}
      </div>

      {layout === 'page' ? <aside className="space-y-4 text-sm lg:w-[35%]">{createdBy}</aside> : null}
    </div>
  );
}

/** One property row: the label in the first grid column, its value in the second. */
function Field({ label, children, top = false }: { label: string; children: ReactNode; top?: boolean }) {
  return (
    <>
      <p className={`text-caption font-medium text-muted-foreground ${top ? 'self-start pt-2' : ''}`}>{label}</p>
      <div className="min-w-0">{children}</div>
    </>
  );
}

/** The card's actions, out of the way until needed: placing it in projects, archiving, sharing a link. */
function CardActionsMenu({ card, onArchive, onCopyLink }: { card: Detail; onArchive: () => void; onCopyLink: () => void }) {
  const ws = useWorkspace();
  const { readOnly } = useWriteAvailability(ws);
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [placing, setPlacing] = useState<'add' | 'move' | null>(null);
  const canPlace = !card.archivedAt && Boolean(card.placements);
  const seesHome = card.placements?.some((p) => p.isHome) ?? false;
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
  const pick = (action: () => void) => { menu.current?.hidePopover(); action(); };
  return (
    <>
      <button type="button" popoverTarget={id} aria-haspopup="menu" aria-label="Card actions" data-testid="card-actions"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216)) });
        }}
        className="tap inline-flex size-8 shrink-0 items-center justify-center rounded-md text-secondary-foreground hover:bg-subtle"><Icon name="more" /></button>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label="Card actions" style={position}
        onToggle={(event) => { if (event.newState === 'open') items()[0]?.focus(); }}
        onKeyDown={(event) => {
          const all = items(); const index = all.indexOf(document.activeElement as HTMLElement);
          const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[event.key];
          if (next === undefined) return;
          event.preventDefault(); all[(next + all.length) % all.length]?.focus();
        }}
        className="fixed m-0 w-52 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg">
        {canPlace ? <button type="button" role="menuitem" tabIndex={-1} disabled={readOnly} className="ui-nav-link tap w-full disabled:opacity-50" onClick={() => pick(() => setPlacing('add'))}><Icon name="plus" />Add to project</button> : null}
        {canPlace && seesHome ? <button type="button" role="menuitem" tabIndex={-1} disabled={readOnly} className="ui-nav-link tap w-full disabled:opacity-50" onClick={() => pick(() => setPlacing('move'))}><Icon name="arrow" />Move to project</button> : null}
        <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => pick(onCopyLink)}><Icon name="attachment" />Copy link</button>
        {!card.archivedAt ? <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full text-danger-text" onClick={() => pick(onArchive)}><Icon name="inbox" />Archive</button> : null}
      </div>
      {placing ? <PlaceCardDialog card={card} mode={placing} onClose={() => setPlacing(null)} /> : null}
    </>
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

function Popover({ label, empty = false, children }: { label: string; empty?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="tap inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-label text-muted-foreground hover:bg-subtle hover:text-foreground">
        <Icon name="plus" className="size-3.5" />
        {empty ? <span>Add</span> : null}
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-md border border-border bg-surface p-2 shadow-lg" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}>
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

/** The card's own people: anyone who can see one of its projects, including ones the viewer cannot see. */
function Assignees({ card, onToggle }: { card: Detail; onToggle: (userId: string, on: boolean) => Promise<void> }) {
  const members = useCardPeople(card.id, 'assignable', card.projectId);
  const assignable = members.data?.data ?? [];
  const assigned = new Set(card.assignees.map((a) => a.id));
  return (
    <div className="flex items-center gap-1">
      {card.assignees.map((a) => (
        <Avatar key={a.id} person={a} size={28} />
      ))}
      <Popover label="Assign members" empty={card.assignees.length === 0}>
        {() => (
          <ul className="space-y-0.5">
            {members.error ? <li role="alert" className="text-label text-danger-text">{errorMessage(members.error)} <Button variant="ghost" onClick={() => void members.refetch()}>Retry people</Button></li> : null}
            {assignable.map((m) => (
              <li key={m.userId}>
                <Checkbox
                  className="rounded px-2 py-1 hover:bg-background"
                  checked={assigned.has(m.userId)}
                  onChange={(e) => void onToggle(m.userId, e.target.checked)}
                  label={<span className="inline-flex items-center gap-2"><Avatar person={{ id: m.userId, name: m.name, avatarUrl: m.avatarUrl }} size={22} />{m.name}</span>}
                />
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
  const labels = useQuery({ queryKey: ['labels', ws.id], queryFn: () => api.get<Page<Label>>(`/workspaces/${ws.id}/labels`) });
  const [creating, setCreating] = useState<string | null>(null);
  const current = card.labels.map((l) => l.id);
  const options = (labels.data?.data ?? card.labels).map((l) => ({ value: l.id, label: l.name, icon: <LabelDot color={l.color} /> }));

  function change(next: string[]) {
    for (const id of next) if (!current.includes(id)) void onToggle(id, true);
    for (const id of current) if (!next.includes(id)) void onToggle(id, false);
  }

  return (
    <>
      {/* Type to find a label; a name with no match offers "Create", which asks for its colour. */}
      <MultiCombobox aria-label="Labels" placeholder="Add a label…" emptyText="No labels yet" options={options} values={current} onChange={change} onCreate={setCreating} className="w-full" />
      {creating !== null ? <NewLabelDialog name={creating} onClose={() => setCreating(null)} onCreated={(label) => onToggle(label.id, true)} /> : null}
    </>
  );
}

function LabelDot({ color }: { color: string }) {
  return <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${LABEL_BG[color] ?? 'bg-disabled-foreground'}`} />;
}

/** Names a new workspace label and picks its colour, then adds it to the card. */
function NewLabelDialog({ name, onClose, onCreated }: { name: string; onClose: () => void; onCreated: (label: Label) => Promise<void> }) {
  const ws = useWorkspace();
  const qc = useQueryClient();
  const [color, setColor] = useState<string>('blue');
  const [text, setText] = useState(name);
  const create = useMutation({
    mutationFn: () => api.post<Label>(`/workspaces/${ws.id}/labels`, { name: text.trim(), color }),
    onSuccess: async (label) => { await qc.invalidateQueries({ queryKey: ['labels', ws.id] }); await onCreated(label); onClose(); },
  });
  return (
    <Dialog title="New label" size="compact" onClose={() => { if (!create.isPending) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (text.trim()) create.mutate(); }}>
        <FormError message={create.error ? errorMessage(create.error) : null} />
        <FormField label="Name"><Input autoFocus required maxLength={60} value={text} onChange={(event) => setText(event.target.value)} /></FormField>
        <fieldset>
          <legend className="mb-2 text-label font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {LABEL_COLORS.map((value) => (
              <label key={value} title={value} className={`tap relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border ${color === value ? 'border-ring bg-primary-subtle' : 'border-border bg-background hover:bg-subtle'}`}>
                <input type="radio" name="color" value={value} aria-label={value} checked={color === value} onChange={() => setColor(value)} className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" />
                <span className={`size-5 rounded-full ${LABEL_BG[value] ?? 'bg-disabled-foreground'}`} />
                <span className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
              </label>
            ))}
          </div>
        </fieldset>
        <p className="flex items-center gap-2 text-label text-muted-foreground">Preview
          <span className="inline-flex items-center gap-1.5 rounded bg-subtle px-2 py-0.5 text-caption font-medium text-secondary-foreground"><LabelDot color={color} />{text.trim() || 'Label'}</span>
        </p>
        <DialogActions>
          <Button variant="ghost" disabled={create.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || !text.trim()}>{create.isPending ? 'Creating…' : 'Create label'}</Button>
        </DialogActions>
      </form>
    </Dialog>
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
      <Select
        value={card.listId}
        aria-label="Move to list"
        size="sm"
        onChange={(listId) => void onMove(listId)}
        className="w-full max-w-60"
        options={(board.data?.lists ?? [{ id: card.listId, name: card.listName }]).map((l) => ({ value: l.id, label: l.name }))}
      />
    </label>
  );
}
