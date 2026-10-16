'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icon';
import { Button } from './ui';

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => { element.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.currentTarget === event.target) onClose(); }} onKeyDown={(event) => event.stopPropagation()}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-overlay/40">
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-5 py-3"><h2 className="min-w-0 flex-1 text-body-lg font-semibold">{title}</h2><Button variant="ghost" size="icon" aria-label={`Close ${title}`} onClick={onClose}><Icon name="close" /></Button></header>
    <div className="space-y-5 p-5">{children}</div>
  </dialog>;
}
