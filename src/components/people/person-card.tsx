'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, GuestChip } from '@/components/ui';
import { api } from '@/lib/api';
import type { Member, Page } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/** A person as team and project reads return them. */
export interface PersonLike { userId: string; name: string; avatarUrl: string | null; guest?: boolean }

/** The workspace roster, keyed by user id: where emails come from (team and project reads carry none). */
export function useRoster() {
  const ws = useWorkspace();
  const roster = useQuery({ queryKey: ['members', ws.id], queryFn: () => api.get<Page<Member>>(`/workspaces/${ws.id}/members`), staleTime: 60_000 });
  const byId = useMemo(() => new Map((roster.data?.data ?? []).map((member) => [member.userId, member])), [roster.data]);
  return { roster, byId };
}

const CARD_WIDTH = 320;

/**
 * An avatar that shows who the person is: hover (mouse), focus or tap opens a small card with a
 * larger avatar, the name and the email. It is a button, so keep it out of links; rows that link
 * use a stretched link and lift this above it.
 */
export function PersonAvatar({ person, email, size = 28 }: { person: PersonLike; email?: string; size?: number }) {
  const [place, setPlace] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();

  const openNow = () => {
    window.clearTimeout(timer.current);
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.bottom + 120 > window.innerHeight;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - CARD_WIDTH / 2), window.innerWidth - CARD_WIDTH - 8);
    setPlace({ top: above ? rect.top - 8 : rect.bottom + 8, left, above });
  };
  const openSoon = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(openNow, 250); };
  const closeSoon = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setPlace(null), 150); };
  const mouse = (handler: () => void) => (event: PointerEvent) => { if (event.pointerType === 'mouse') handler(); };

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!place) return;
    const close = () => setPlace(null);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    const onDown = (event: globalThis.PointerEvent) => { if (!button.current?.contains(event.target as Node)) close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [place]);

  const ref = { id: person.userId, name: person.name, avatarUrl: person.avatarUrl };
  return <>
    <button ref={button} type="button" aria-label={person.name} aria-describedby={place ? id : undefined} data-testid="person-avatar"
      onPointerEnter={mouse(openSoon)} onPointerLeave={mouse(closeSoon)} onFocus={openSoon} onBlur={closeSoon} onClick={openNow}
      className="relative z-10 shrink-0 rounded-full">
      <Avatar person={ref} size={size} plain />
    </button>
    {place ? createPortal(<div id={id} role="tooltip" data-testid="person-card" onPointerEnter={mouse(openNow)} onPointerLeave={mouse(closeSoon)}
      style={{ top: place.top, left: place.left, width: CARD_WIDTH }}
      className={`fixed z-50 flex items-center gap-3 rounded-xl border border-border bg-popover p-4 shadow-lg ${place.above ? '-translate-y-full' : ''}`}>
      <Avatar person={ref} size={48} plain />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{person.name}</p>
        {email ? <p className="text-label text-muted-foreground [overflow-wrap:anywhere]">{email}</p> : null}
        {person.guest ? <div className="mt-1"><GuestChip /></div> : null}
      </div>
    </div>, document.body) : null}
  </>;
}

/** Overlapping avatars, each with its person card, then "+N". */
export function AvatarStack({ people, label, max = 4, size = 28 }: { people: PersonLike[]; label: string; max?: number; size?: number }) {
  const { byId } = useRoster();
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return <ul aria-label={label} className="flex items-center -space-x-1.5">
    {shown.map((person) => <li key={person.userId} className="flex"><PersonAvatar person={person} email={byId.get(person.userId)?.email} size={size} /></li>)}
    {rest > 0 ? <li className="flex"><span aria-label={`${rest} more`} style={{ width: size, height: size }} className="relative inline-flex items-center justify-center rounded-full bg-muted text-caption font-semibold text-secondary-foreground ring-2 ring-surface">+{rest}</span></li> : null}
  </ul>;
}
