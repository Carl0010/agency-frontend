'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Avatar } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * The signed-in person's menu: Your settings (members only) and Log out, kept out of plain
 * sight. `row` is the sidebar footer (avatar, name, role; opens upward); `avatar` is a
 * compact header trigger (opens downward, right-aligned). Used by both audiences, so it shows
 * only the person's own name and the subtitle the caller passes.
 */
export function AccountMenu({ variant = 'row', subtitle, settingsHref, onNavigate }: {
  variant?: 'row' | 'avatar'; subtitle?: string; settingsHref?: string; onNavigate?: () => void;
}) {
  const { user, signOut } = useSession();
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const anchor = useRef<DOMRect | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});
  if (!user) return null;

  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  function place() {
    const rect = anchor.current; const box = menu.current?.getBoundingClientRect();
    if (!rect || !box) return;
    if (variant === 'row') setStyle({ left: rect.left, width: rect.width, top: Math.max(8, rect.top - box.height - 6) });
    else setStyle({ left: Math.max(8, rect.right - box.width), top: rect.bottom + 6 });
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const all = items(); const index = all.indexOf(document.activeElement as HTMLElement);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    all[(next + all.length) % all.length]?.focus();
  }
  async function logout() {
    menu.current?.hidePopover();
    try {
      await signOut();
      onNavigate?.();
      router.replace('/login');
    } catch (error) { toast(errorMessage(error)); }
  }

  return <>
    <button type="button" popoverTarget={id} aria-haspopup="menu" aria-label={`${user.name}, open menu`} data-testid="account-menu"
      onClick={(event) => { anchor.current = event.currentTarget.getBoundingClientRect(); }}
      className={variant === 'row'
        ? 'tap flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left hover:bg-hover'
        : 'tap flex items-center gap-1 rounded-full p-0.5 hover:bg-hover'}>
      <Avatar person={{ ...user, active: true }} size={variant === 'row' ? 30 : 28} />
      {variant === 'row' ? <>
        <span className="min-w-0 flex-1"><span className="block truncate text-label font-medium">{user.name}</span>{subtitle ? <span className="block text-caption capitalize text-muted-foreground">{subtitle}</span> : null}</span>
        <Icon name="chevron" className="size-3.5 shrink-0 -rotate-90 text-muted-foreground" />
      </> : null}
    </button>
    <div ref={menu} id={id} popover="auto" role="menu" aria-label={`Signed in as ${user.name}`} style={style} onKeyDown={onKeyDown}
      onToggle={(event) => { if (event.newState === 'open') { place(); items()[0]?.focus(); } }}
      className="fixed m-0 min-w-52 rounded-xl border border-border bg-popover p-1.5 text-foreground shadow-lg">
      <p className="truncate px-2.5 pb-1.5 pt-1 text-caption text-muted-foreground">{user.email}</p>
      {settingsHref ? <Link role="menuitem" tabIndex={-1} href={settingsHref} className="ui-nav-link tap w-full"
        onClick={() => { menu.current?.hidePopover(); onNavigate?.(); }}><Icon name="person" />Your settings</Link> : null}
      <div role="separator" className="my-1 border-t border-border-subtle" />
      <button type="button" role="menuitem" tabIndex={-1} className="ui-nav-link tap w-full" onClick={() => void logout()}><Icon name="logout" />Log out</button>
    </div>
  </>;
}
