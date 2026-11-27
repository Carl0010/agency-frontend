'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icon';
import { Button } from './ui';

/** On phones a dialog with several fields fills the screen: no margin, no corners, header pinned on top. */
export const FULL_SCREEN_ON_PHONE = 'max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:shadow-none';

/**
 * A modal dialog. `size="compact"` keeps it a small centred box on phones too, for a single
 * question or field; the default fills a phone's screen. Mark the field to type in first with
 * `data-autofocus`: React's autoFocus runs before the dialog opens, so it loses to the close button.
 */
export function Dialog({ title, children, onClose, size = 'full' }: { title: string; children: ReactNode; onClose: () => void; size?: 'full' | 'compact' }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    // showModal() focuses the first focusable element (the close button); a field marked data-autofocus wins.
    element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.currentTarget === event.target) onClose(); }} onKeyDown={(event) => event.stopPropagation()}
    className={`fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-overlay/40 ${size === 'full' ? FULL_SCREEN_ON_PHONE : ''}`}>
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-5 py-3 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))]"><h2 className="min-w-0 flex-1 text-body-lg font-semibold">{title}</h2><Button variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></Button></header>
    <div className={`dialog-body space-y-5 p-5 ${size === 'full' ? 'max-sm:flex max-sm:min-h-[calc(100dvh-3.75rem)] max-sm:flex-col' : ''}`}>{children}</div>
  </dialog>;
}

/** A dialog form's Cancel/Save row. On phones it stays pinned to the bottom of the screen while the fields scroll. */
export function DialogActions({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex justify-end gap-2 max-sm:sticky max-sm:-bottom-5 max-sm:z-10 max-sm:-mx-5 max-sm:-mb-5 max-sm:border-t max-sm:border-border max-sm:bg-surface max-sm:px-5 max-sm:pt-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:mt-auto max-sm:[&>*]:flex-1 ${className}`}>{children}</div>;
}
