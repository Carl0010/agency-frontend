'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { ArrivalSettingsForm } from '@/components/arrival-settings';
import { Icon } from '@/components/icon';
import { LoadingSkeleton } from '@/components/skeleton';
import { Dialog } from '@/components/ui-dialog';
import { api, errorMessage } from '@/lib/api';
import { cardRef } from '@/lib/cards';
import type { CardTile, Page } from '@/lib/types';

/**
 * The project's less-used actions, kept out of the header: archived cards and arrival settings.
 * A popover menu with arrow-key navigation; each item opens a dialog.
 */
export function ProjectMenu({ projectId, boardId, canEdit, cardHref }: { projectId: string; boardId: string; canEdit: boolean; cardHref: (id: string) => string }) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [dialog, setDialog] = useState<'archived' | 'arrival' | null>(null);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const open = (which: 'archived' | 'arrival') => { menu.current?.hidePopover(); setDialog(which); };
  return <>
    <button type="button" popoverTarget={id} aria-haspopup="menu" aria-label="Project options" data-testid="project-menu"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216)) });
      }}
      className="tap inline-flex size-9 shrink-0 items-center justify-center rounded-md text-secondary-foreground hover:bg-hover"><Icon name="more" /></button>
    <div ref={menu} id={id} popover="auto" role="menu" aria-label="Project options" style={position}
      onToggle={(event) => { if (event.newState === 'open') items()[0]?.focus(); }}
      onKeyDown={(event) => {
        const all = items(); const index = all.indexOf(document.activeElement as HTMLElement);
        const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[event.key];
        if (next === undefined) return;
        event.preventDefault(); all[(next + all.length) % all.length]?.focus();
      }}
      className="fixed m-0 w-52 rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-lg">
      <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => open('archived')}><Icon name="inbox" />Archived cards</button>
      <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => open('arrival')}><Icon name="clock" />Arrival settings</button>
    </div>
    {dialog === 'archived' ? <Dialog title="Archived cards" onClose={() => setDialog(null)}><ArchivedCards boardId={boardId} cardHref={cardHref} onOpen={() => setDialog(null)} /></Dialog> : null}
    {dialog === 'arrival' ? <Dialog title="Arrival settings" onClose={() => setDialog(null)}><ArrivalSettingsForm projectId={projectId} canEdit={canEdit} /></Dialog> : null}
  </>;
}

function ArchivedCards({ boardId, cardHref, onOpen }: { boardId: string; cardHref: (id: string) => string; onOpen: () => void }) {
  const archived = useQuery({ queryKey: ['archived', boardId], queryFn: () => api.get<Page<CardTile>>(`/boards/${boardId}/archived-cards`) });
  if (archived.isPending) return <LoadingSkeleton label="Loading archived cards" />;
  if (archived.error) return <p role="alert" className="text-label text-danger-text">{errorMessage(archived.error)}</p>;
  if (!archived.data.data.length) return <p className="text-label text-muted-foreground">No archived cards.</p>;
  return <ul className="-mx-2 max-h-96 space-y-0.5 overflow-y-auto">
    {archived.data.data.map((card) => <li key={card.id}>
      <Link href={cardHref(card.id)} onClick={onOpen} className="tap flex items-center gap-2 rounded-md px-2 py-1.5 text-label hover:bg-hover">
        <span className="shrink-0 font-mono text-caption text-muted-foreground">{cardRef(card)}</span><span className="min-w-0 truncate">{card.title}</span>
      </Link>
    </li>)}
  </ul>;
}
