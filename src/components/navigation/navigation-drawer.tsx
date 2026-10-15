'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

/** Native modal dialog supplies focus containment and makes the rest of the app inert. */
export function NavigationDrawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = (event: MediaQueryListEvent) => { if (event.matches) onClose(); };
    desktop.addEventListener('change', resize);
    return () => {
      desktop.removeEventListener('change', resize);
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [onClose]);

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      onClose(); // The workspace search listener owns the shortcut itself.
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // React Strict Mode replays effect cleanup; programmatic close events from
  // cleanup must not dismiss a freshly reopened modal. Own dismissal explicitly.
  return <dialog ref={dialog} aria-label="Workspace navigation" data-testid="navigation-drawer"
    onKeyDown={containFocus}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-2rem))] max-w-none overflow-hidden border-r border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-overlay/40">
    {children}
  </dialog>;
}
