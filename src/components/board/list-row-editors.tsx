'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { DuePill } from '@/components/due-pill';
import { Avatar, Button, Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import { applyTile } from '@/lib/realtime';
import { toLocalInput } from '@/lib/time';
import type { CardTile, Member } from '@/lib/types';

export function RowAssignees({ card, cardKey, members }: { card: CardTile; cardKey: string; members: Member[] }) {
  const mutation = useRowSave(card);
  return <RowPopover label={`Assign members for ${cardKey}`} title={`Assignees for ${cardKey}`} onOpen={() => mutation.reset()} trigger={card.assignees.length ? <span role="group" aria-label="Assignees" className="inline-flex min-w-0 items-center gap-1.5" title={card.assignees.map((person) => person.name).join(', ')}>
    <span className="inline-flex -space-x-1.5">{card.assignees.slice(0, 2).map((person) => <Avatar key={person.id} person={person} size={22} />)}</span><span className="truncate">{card.assignees.length === 1 ? card.assignees[0]!.name : `${card.assignees.length} members`}</span>
  </span> : <span className="text-muted-foreground">Unassigned</span>}>
    {(close) => <>
      <div className="max-h-60 space-y-1 overflow-y-auto p-2">
        {members.length ? members.map((member) => {
          const selected = card.assignees.some((person) => person.id === member.userId);
          return <button key={member.userId} type="button" aria-label={member.name} aria-pressed={selected} disabled={mutation.isPending} onClick={() => void mutation.save(() => selected ? api.del<CardTile>(`/cards/${card.id}/assignees/${member.userId}`) : api.post<CardTile>(`/cards/${card.id}/assignees/${member.userId}`))}
            className={`tap flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-label disabled:opacity-50 ${selected ? 'bg-primary-subtle text-primary-text' : 'hover:bg-subtle'}`}>
            <Avatar person={{ id: member.userId, name: member.name, avatarUrl: member.avatarUrl }} size={24} /><span className="min-w-0 flex-1 break-words">{member.name}</span>{selected ? <Icon name="check" /> : null}
          </button>;
        }) : <p className="p-2 text-label text-muted-foreground">No active members available.</p>}
      </div>
      {mutation.error ? <p role="alert" className="px-4 pb-2 text-caption text-danger-text">{errorMessage(mutation.error)}</p> : null}
      <div className="flex justify-end border-t border-border p-2"><Button variant="ghost" onClick={close}>Done</Button></div>
    </>}
  </RowPopover>;
}

export function RowDue({ card, cardKey, now }: { card: CardTile; cardKey: string; now: Date }) {
  const [draft, setDraft] = useState('');
  const [done, setDone] = useState(false);
  const mutation = useRowSave(card);
  return <RowPopover label={`Edit due date for ${cardKey}`} title={`Due date for ${cardKey}`} onOpen={() => { setDraft(toLocalInput(card.dueAt)); setDone(Boolean(card.dueCompletedAt)); mutation.reset(); }} trigger={card.dueAt ? <DuePill dueAt={card.dueAt} dueCompletedAt={card.dueCompletedAt} now={now} /> : <span className="text-muted-foreground">No due date</span>}>
    {(close) => <form className="space-y-3 p-3" onSubmit={(event) => {
      event.preventDefault();
      const dueAt = draft ? new Date(draft).toISOString() : null;
      void mutation.save(() => api.patch<CardTile>(`/cards/${card.id}`, { dueAt, dueCompletedAt: dueAt && done ? card.dueCompletedAt ?? new Date().toISOString() : null })).then((saved) => { if (saved) close(); });
    }}>
      <label className="block space-y-1 text-label"><span>Due date</span><Input data-autofocus type="datetime-local" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={mutation.isPending} /></label>
      {draft ? <label className="tap flex items-center gap-2 text-label"><input type="checkbox" checked={done} onChange={(event) => setDone(event.target.checked)} disabled={mutation.isPending} />Mark due date complete</label> : null}
      {mutation.error ? <p role="alert" className="text-caption text-danger-text">{errorMessage(mutation.error)}</p> : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {card.dueAt ? <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => void mutation.save(() => api.patch<CardTile>(`/cards/${card.id}`, { dueAt: null, dueCompletedAt: null })).then((saved) => { if (saved) close(); })}>Remove due date</Button> : null}
        <Button variant="ghost" size="sm" className="ml-auto" disabled={mutation.isPending} onClick={close}>Cancel</Button><Button type="submit" size="sm" disabled={mutation.isPending}>Save</Button>
      </div>
    </form>}
  </RowPopover>;
}

/** Native top-layer popovers remain usable inside a scrolling table and beside a drawer. */
function RowPopover({ label, title, trigger: contents, children, onOpen }: { label: string; title: string; trigger: ReactNode; children: (close: () => void) => ReactNode; onOpen: () => void }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 480 });
  const dismiss = () => { panel.current?.hidePopover(); trigger.current?.focus({ preventScroll: true }); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect(); const element = panel.current;
      if (!anchor || !element) return;
      if (!anchor.width) { element.hidePopover(); return; }
      const width = element.getBoundingClientRect().width;
      const below = Math.max(0, window.innerHeight - anchor.bottom - 20); const above = Math.max(0, anchor.top - 20);
      const upwards = below < Math.min(element.scrollHeight + 2, 240) && above > below;
      const maxHeight = upwards ? above : below;
      setPosition({ top: upwards ? Math.max(12, anchor.top - Math.min(element.scrollHeight + 2, maxHeight) - 8) : anchor.bottom + 8, left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), maxHeight });
    };
    place();
    const focus = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('button');
    focus?.focus({ preventScroll: true });
    const observer = new ResizeObserver(place);
    if (trigger.current) observer.observe(trigger.current);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener('resize', place); document.addEventListener('scroll', place, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} popoverTarget={id} className="tap inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 text-left text-label hover:bg-muted">{contents}</button>
    <div ref={panel} id={id} role="dialog" aria-modal="false" aria-label={title} popover="auto" onToggle={(event) => { const opening = event.newState === 'open'; setOpen(opening); if (opening) onOpen(); }} style={position} className="fixed inset-auto m-0 w-80 max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-0 text-foreground shadow-lg">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2"><h3 className="min-w-0 flex-1 truncate text-label font-semibold">{title}</h3><Button variant="ghost" size="icon" aria-label="Close editor" onClick={dismiss}><Icon name="close" /></Button></div>
      {children(dismiss)}
    </div>
  </>;
}

function useRowSave(card: CardTile) {
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationKey: ['row-card', card.id],
    mutationFn: (write: () => Promise<CardTile>) => write(),
    onSuccess: (tile) => applyTile(qc, tile),
    onError: (error) => toast(errorMessage(error)),
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['board', card.boardId] }); void qc.invalidateQueries({ queryKey: ['card', card.id] }); },
  });
  async function save(write: () => Promise<CardTile>) {
    try { await mutation.mutateAsync(write); return true; }
    catch { return false; } // onError shows the failure; editors retain their draft.
  }
  return { ...mutation, save };
}

/** Title is text until clicked; the card key remains a separate drawer link. */
export function RowName({ card, cardKey }: { card: CardTile; cardKey: string }) {
  const [editing, setEditing] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const saving = useRef(false);
  const id = useId();
  const mutation = useRowSave(card);
  const error = validation ?? (mutation.error ? errorMessage(mutation.error) : null);
  useLayoutEffect(() => { if (editing) { input.current?.focus({ preventScroll: true }); input.current?.select(); } }, [editing]);
  const restoreFocus = () => requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  async function save(value: string) {
    if (saving.current) return;
    const title = value.trim();
    if (!title) { setValidation('Enter a card name.'); return; }
    if (title === card.title) { setEditing(false); return; }
    saving.current = true; setValidation(null);
    const saved = await mutation.save(() => api.patch<CardTile>(`/cards/${card.id}`, { title }));
    if (saved) { setEditing(false); if (document.activeElement === document.body) restoreFocus(); }
    saving.current = false;
  }
  return <div className="min-w-0 flex-1">
    {editing ? <Input ref={input} defaultValue={card.title} maxLength={500} required aria-label={`Card name for ${cardKey}`} aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined} disabled={mutation.isPending}
      onBlur={(event) => void save(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape' && !saving.current) { event.preventDefault(); event.stopPropagation(); setEditing(false); restoreFocus(); } }}
      className="min-w-0 py-1 text-label" /> : <button ref={trigger} type="button" aria-label={`Edit name for ${cardKey}`} title={card.title} onClick={() => { mutation.reset(); setValidation(null); setEditing(true); }} className="tap block w-full truncate rounded-md px-1 text-left text-label font-medium hover:bg-muted">{card.title}</button>}
    {editing && error ? <p id={id} role="alert" className="mt-1 break-words text-caption text-danger-text">{error}</p> : null}
  </div>;
}
