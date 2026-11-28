'use client';

import { CardSkeleton } from '@/components/skeleton';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DuePill } from '@/components/due-pill';
import { Icon } from '@/components/icon';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { ArrivalChip } from '@/components/arrival';
import { ReplanAction } from '@/components/arrival-actions';
import { useToast } from '@/components/toast';
import { Avatar, Button, Checkbox, DatePicker, Field as FormField, Input, LABEL_BG, MultiCombobox, Select } from '@/components/ui';
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
import { Attachments, uploadCardAttachment } from './attachments';
import type { RichEditorHandle } from './rich-editor';
import { ToolButton } from './tool-button';
import { CardPlacements, PlaceCardDialog } from './card-placements';
import { Checklists } from './checklists';
import { Comments } from './comments';

const LABEL_COLORS = ['grey', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown'] as const;

/**
 * Card detail (§3.3). Rendered inside the board drawer and as a full page with full=true. Opened in
 * the URL's project: a card can be in several (docs/CARD_PLACEMENTS.md in the API repository). When
 * the person cannot see it there, the API shows it in a project they can, and the URL follows.
 */
export function CardDetail({ cardId, projectId, layout = 'page' }: { cardId: string; projectId: string; layout?: 'page' | 'drawer' }) {
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
      // The card on its own board, so the link works from My work too.
      .writeText(`${window.location.origin}${cardUrl(ws.id, c, c.id, new URLSearchParams(window.location.search).get('full') === 'true' ? '?full=true' : '')}`)
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
          <Description card={c} onSave={async (description) => { applyTile(qc, await api.patch<CardTile>(cardPath(c.id, c.projectId), { description })); void qc.invalidateQueries({ queryKey: ['card', c.id] }); }} />
          <Checklists cardId={c.id} projectId={c.projectId} checklists={c.checklists} />
          <Attachments cardId={c.id} projectId={c.projectId} attachments={c.attachments} />
          <Comments
            inDrawer={layout === 'drawer'}
            cardId={c.id}
            projectId={c.projectId}
            activity={[
              { id: 'created', at: c.createdAt, person: c.createdBy, text: 'created this card' },
              ...c.attachments.filter((a) => a.uploaded).map((a) => ({ id: `attachment-${a.id}`, at: a.createdAt, person: a.uploadedBy, text: <>attached <span className="font-medium text-foreground">{a.filename}</span></> })),
            ]}
          />
        </MentionScopeContext.Provider>
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
        className="tap inline-flex size-8 shrink-0 items-center justify-center rounded-md text-secondary-foreground hover:bg-hover"><Icon name="more" /></button>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label="Card actions" style={position}
        onToggle={(event) => { if (event.newState === 'open') items()[0]?.focus(); }}
        onKeyDown={(event) => {
          const all = items(); const index = all.indexOf(document.activeElement as HTMLElement);
          const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[event.key];
          if (next === undefined) return;
          event.preventDefault(); all[(next + all.length) % all.length]?.focus();
        }}
        className="fixed m-0 w-52 rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-lg">
        {canPlace ? <button type="button" role="menuitem" tabIndex={-1} disabled={readOnly} className="ui-nav-link tap w-full disabled:opacity-50" onClick={() => pick(() => setPlacing('add'))}><Icon name="plus" />Add to project</button> : null}
        {canPlace && seesHome ? <button type="button" role="menuitem" tabIndex={-1} disabled={readOnly} className="ui-nav-link tap w-full disabled:opacity-50" onClick={() => pick(() => setPlacing('move'))}><Icon name="arrow" />Move to project</button> : null}
        <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => pick(onCopyLink)}><Icon name="attachment" />Copy link</button>
        {!card.archivedAt ? <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full text-danger-text" onClick={() => pick(onArchive)}><Icon name="inbox" />Archive</button> : null}
      </div>
      {placing ? <PlaceCardDialog card={card} mode={placing} onClose={() => setPlacing(null)} /> : null}
    </>
  );
}

/** Shared by the title and its editor, so switching between them moves nothing: same box, border, padding and line height. */
const TITLE_BOX = 'tap -mx-1.5 min-h-9 w-[calc(100%+0.75rem)] rounded-md border px-1.5 py-0.5 text-left text-xl font-semibold leading-7';

function Title({ card, onSave }: { card: Detail; onSave: (title: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  // The editor wraps like the heading does: it grows to fit, so long titles keep their lines.
  const fit = (el: HTMLTextAreaElement | null) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`; } };
  return (
    <h1 className="mt-1">
      {editing ? (
        <textarea
          ref={(el) => { fit(el); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); }}
          defaultValue={card.title}
          aria-label="Card title"
          maxLength={500}
          rows={1}
          onInput={(e) => fit(e.currentTarget)}
          onBlur={(e) => {
            setEditing(false);
            const t = e.target.value.replace(/\s+/g, ' ').trim();
            if (t && t !== card.title) void onSave(t);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditing(false);
            }
          }}
          className={`${TITLE_BOX} block resize-none overflow-hidden border-ring bg-surface shadow-[0_0_0_2px_var(--color-primary-border)] outline-none`}
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)} className={`${TITLE_BOX} flex items-start break-words border-transparent hover:bg-background`} data-testid="card-title">
          {card.title}
        </button>
      )}
    </h1>
  );
}

function Popover({ label, empty = false, children }: { label: string; empty?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="tap inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-label text-muted-foreground hover:bg-hover hover:text-foreground">
        <Icon name="plus" className="size-3.5" />
        {empty ? <span>Add</span> : null}
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1 w-64 rounded-md border border-border bg-popover p-2 shadow-lg" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}>
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
              <label key={value} title={value} className={`tap relative inline-flex size-10 cursor-pointer items-center justify-center rounded-lg border ${color === value ? 'border-ring bg-primary-subtle' : 'border-border bg-background hover:bg-hover'}`}>
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

/** The due date and time, picked from a calendar. Saves once, when the calendar closes; clearing it also clears Done. */
function DueDate({ card, onSave }: { card: Detail; onSave: (patch: { dueAt?: string | null; dueCompletedAt?: string | null }) => Promise<void> }) {
  const saved = toLocalInput(card.dueAt) || null;
  const [draft, setDraft] = useState<string | null>(saved);
  // Read when the calendar closes, which can come straight after a change, before the next render.
  const latest = useRef(saved);
  useEffect(() => { setDraft(saved); latest.current = saved; }, [saved]);
  return (
    <div className="w-60 max-w-full">
      <DatePicker aria-label="Due date" placeholder="Set a due date" size="sm" withTime defaultTime="17:00" value={draft}
        onChange={(v) => { latest.current = v; setDraft(v); }}
        onOpenChange={(open) => {
          if (open) return;
          const dueAt = latest.current ? new Date(latest.current).toISOString() : null;
          if (dueAt === card.dueAt) return;
          void onSave(dueAt ? { dueAt } : { dueAt: null, dueCompletedAt: null });
        }} />
    </div>
  );
}

function Due({ card, now, onSave }: { card: Detail; now: Date; onSave: (patch: { dueAt?: string | null; dueCompletedAt?: string | null }) => Promise<void> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} />
      <DueDate card={card} onSave={onSave} />
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

/** The description editor loads with the card; until then the box keeps its place. */
const DescriptionEditor = dynamic(() => import('./rich-editor'), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="min-h-24 px-3 py-2 text-body text-muted-foreground">Add a description…</div>,
});

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The description: a formatting editor that saves itself a moment after typing stops and when it
 * loses focus. Images (toolbar, paste or drop) upload as the card's attachments and show inline.
 * Until a save succeeds the draft is also kept in localStorage, so a closed tab loses nothing (§3.3).
 */
function Description({ card, onSave }: { card: Detail; onSave: (d: string | null) => Promise<void> }) {
  const draftKey = `agency:draft:desc:${card.id}`;
  const ws = useWorkspace();
  const qc = useQueryClient();
  const toast = useToast();
  const { readOnly } = useWriteAvailability(ws);
  const editor = useRef<RichEditorHandle>(null);
  const picker = useRef<HTMLInputElement>(null);
  const server = card.description ?? '';
  const [initial] = useState(() => readDraft(draftKey) ?? server);
  const latest = useRef(initial);
  const saved = useRef(server);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [state, setState] = useState<SaveState>(initial !== server ? 'idle' : 'saved');
  const [focused, setFocused] = useState(false);
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(0);

  // Someone else saved while this box was idle: show their version.
  useEffect(() => {
    if (focused || server === saved.current || latest.current !== saved.current) return;
    saved.current = server;
    latest.current = server;
    editor.current?.setMarkdown(server);
  }, [server, focused]);

  async function flush() {
    clearTimeout(timer.current);
    const value = latest.current;
    if (value === saved.current) return;
    setState('saving');
    try {
      await onSave(value.trim() ? value : null);
      saved.current = value;
      if (latest.current === value) { writeDraft(draftKey, null); setState('saved'); }
    } catch (err) {
      setState('error');
      toast(errorMessage(err));
    }
  }

  function change(markdown: string) {
    latest.current = markdown;
    writeDraft(draftKey, markdown === saved.current ? null : markdown);
    setState('idle');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1000);
  }

  // Save what's left when the card closes.
  useEffect(() => () => { clearTimeout(timer.current); if (latest.current !== saved.current) void onSave(latest.current.trim() ? latest.current : null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function addImages(files: File[]) {
    for (const f of files) {
      setUploading((n) => n + 1);
      try {
        editor.current?.insertImage(await uploadCardAttachment(card.id, card.projectId, f), f.name);
      } catch (err) {
        toast(`${f.name}: ${errorMessage(err)}`);
      } finally {
        setUploading((n) => n - 1);
        void qc.invalidateQueries({ queryKey: ['card', card.id] });
      }
    }
  }

  const status = uploading ? 'Uploading image…' : state === 'saving' ? 'Saving…' : state === 'saved' && latest.current ? 'Saved' : state === 'error' ? 'Couldn’t save' : '';
  return (
    <section
      aria-label="Description"
      className="space-y-1"
      // Focus anywhere in the section (the text, or the toolbar's link field) counts as editing.
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setFocused(false); void flush(); } }}
    >
      {/* While editing, the formatting toolbar takes the label's place in this row, at the same height, so nothing below moves. */}
      <div className="flex min-h-8 items-center justify-between gap-2 max-sm:min-h-11">
        <h2 className={`text-sm font-semibold text-secondary-foreground ${focused ? 'sr-only' : ''}`}>Description</h2>
        <div ref={setToolbarSlot} className={`min-w-0 flex-1 ${focused ? '' : 'hidden'}`} />
        <p role="status" data-testid="description-status" className="flex shrink-0 items-center gap-2 text-caption text-muted-foreground">
          {status}
          {state === 'error' ? <button type="button" className="tap font-medium text-primary-text" onClick={() => void flush()}>Retry</button> : null}
        </p>
      </div>
      <div
        data-testid="description"
        className={`flex flex-col rounded-lg border ${focused ? 'border-ring ring-2 ring-primary-border' : 'border-transparent bg-background hover:border-border'}`}
      >
        <DescriptionEditor
          ref={editor}
          value={initial}
          onChange={change}
          onSubmit={() => void flush()}
          onImageFiles={readOnly ? undefined : (files) => void addImages(files)}
          editable={!readOnly}
          label="Description"
          placeholder="Add a description…"
          mentionable={[]}
          toolbar={focused}
          toolbarTarget={toolbarSlot}
          actions={<ToolButton label="Insert image" icon="image" disabled={readOnly || uploading > 0} onClick={() => picker.current?.click()} />}
          className="min-h-24"
        />
        <input ref={picker} type="file" accept="image/*" multiple hidden aria-hidden="true" tabIndex={-1}
          onChange={(e) => { void addImages(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
      </div>
    </section>
  );
}

function readDraft(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeDraft(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Storage can be unavailable; the autosave still runs. */ }
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
