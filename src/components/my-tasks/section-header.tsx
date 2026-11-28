'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Input } from '@/components/ui';
import type { MyTaskSection } from '@/lib/types';

export interface SectionActions {
  rename: (section: MyTaskSection, name: string) => Promise<boolean>;
  move: (section: MyTaskSection, step: -1 | 1) => void;
  remove: (section: MyTaskSection) => void;
}

/**
 * A My tasks section heading: click the name to rename it; the menu renames, moves it left or right
 * (up or down in List) and deletes it. Recently assigned can be renamed and moved, never deleted.
 */
export function SectionHeader({ section, shown, total, first, last, actions, readOnly, startEditing = false, onEditingFinished, layout = 'kanban', leading }: {
  section: MyTaskSection; shown: number; total: number; first: boolean; last: boolean; actions: SectionActions; readOnly: boolean;
  startEditing?: boolean; onEditingFinished?: () => void; layout?: 'kanban' | 'list'; leading?: ReactNode;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useLayoutEffect(() => { if (startEditing) setEditing(true); }, [startEditing]);
  useLayoutEffect(() => {
    if (!editing) return;
    input.current?.focus({ preventScroll: true });
    input.current?.select();
  }, [editing]);

  function finish(restoreFocus = false) {
    setEditing(false); onEditingFinished?.();
    if (restoreFocus) requestAnimationFrame(() => title.current?.focus({ preventScroll: true }));
  }
  async function save(name: string) {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === section.name) { finish(); return; }
    setSaving(true);
    const ok = await actions.rename(section, trimmed);
    setSaving(false);
    if (ok) finish();
  }
  const pick = (run: () => void) => { menu.current?.hidePopover(); run(); };
  const [back, forward] = layout === 'kanban' ? ['Move left', 'Move right'] : ['Move up', 'Move down'];

  return <header data-testid="my-tasks-section-header" className={`flex shrink-0 items-center gap-2 ${layout === 'kanban' ? 'h-12 px-2.5 sm:h-15 sm:px-3' : 'h-12 px-2'}`}>
    {leading}
    {editing ? <Input ref={input} disabled={saving} aria-busy={saving} defaultValue={section.name} aria-label="Section name" maxLength={100}
      onBlur={(event) => void save(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape' && !saving) { event.preventDefault(); event.stopPropagation(); finish(true); } }}
      className="min-w-0 flex-1 px-2 py-1.5 text-sm font-semibold" />
      : <h2 className="min-w-0 flex-1"><button type="button" ref={title} disabled={readOnly} onClick={() => setEditing(true)} title={readOnly ? section.name : `${section.name} · Click to rename`}
        className="tap min-h-9 w-full truncate rounded-md px-1 text-left text-sm font-semibold hover:bg-muted disabled:hover:bg-transparent">{section.name}</button></h2>}
    <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-border bg-surface px-1.5 text-caption font-medium text-secondary-foreground" aria-label={`${shown} of ${total} cards`}>
      {shown === total ? total : `${shown}/${total}`}
    </span>
    {readOnly ? null : <>
      <button type="button" aria-label={`Section actions for ${section.name}`} popoverTarget={menuId} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 176)), left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)) });
      }} className="tap inline-flex min-h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"><Icon name="more" /></button>
      <div ref={menu} id={menuId} popover="auto" role="group" aria-label={`Actions for ${section.name}`} style={position} className="fixed m-0 w-44 rounded-lg border border-border bg-popover p-1 text-sm text-foreground shadow-lg">
        <button type="button" className="ui-nav-link tap w-full" onClick={() => pick(() => setEditing(true))}><Icon name="pen" />Rename</button>
        <button type="button" className="ui-nav-link tap w-full disabled:opacity-40" disabled={first} onClick={() => pick(() => actions.move(section, -1))}><Icon name="chevron" className={layout === 'kanban' ? 'rotate-180' : '-rotate-90'} />{back}</button>
        <button type="button" className="ui-nav-link tap w-full disabled:opacity-40" disabled={last} onClick={() => pick(() => actions.move(section, 1))}><Icon name="chevron" className={layout === 'kanban' ? '' : 'rotate-90'} />{forward}</button>
        {section.kind === 'recent' ? null : <button type="button" className="ui-nav-link tap w-full text-danger-text" onClick={() => pick(() => actions.remove(section))}><Icon name="trash" />Delete section</button>}
      </div>
    </>}
  </header>;
}
