'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icon';
import { Button } from './ui';

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
}
type Request = ConfirmationOptions & { id: number; settle: (accepted: boolean) => void };
type ConfirmAction = (options: ConfirmationOptions) => Promise<boolean>;
const Context = createContext<ConfirmAction | null>(null);

/** Presentation only: the caller still owns the authorized API action and its errors. */
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const sequence = useRef(0);
  const pending = useRef(new Set<(accepted: boolean) => void>());
  const ask = useCallback<ConfirmAction>((options) => new Promise((resolve) => {
    const settle = (accepted: boolean) => { pending.current.delete(settle); resolve(accepted); };
    pending.current.add(settle);
    const request = { ...options, id: ++sequence.current, settle };
    setRequests((queue) => [...queue, request]);
  }), []);
  useEffect(() => {
    const unresolved = pending.current;
    return () => { for (const settle of unresolved) settle(false); };
  }, []);
  const current = requests[0];
  return <Context.Provider value={ask}>{children}{current ? <ConfirmationModal key={current.id} request={current} onAnswer={(accepted) => {
    current.settle(accepted);
    setRequests((queue) => queue.slice(1));
  }} /> : null}</Context.Provider>;
}

export function useConfirm(): ConfirmAction {
  const action = useContext(Context);
  if (!action) throw new Error('ConfirmationProvider is missing');
  return action;
}

function ConfirmationModal({ request, onAnswer }: { request: Request; onAnswer: (accepted: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    cancel.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  function keyboard(event: KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation();
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return createPortal(<dialog ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onKeyDown={keyboard}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onAnswer(false); }}
    onClick={(event) => { if (event.target === event.currentTarget) onAnswer(false); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-overlay/45">
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4"><span className={`inline-flex size-11 items-center justify-center rounded-xl ${request.tone === 'primary' ? 'bg-primary-subtle text-primary-text' : 'bg-danger-subtle text-danger-text'}`}><Icon name="warning" className="size-5" /></span><Button variant="ghost" size="icon" aria-label="Close confirmation" onClick={() => onAnswer(false)}><Icon name="close" /></Button></div>
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">{request.title}</h2>
      <p id={`${id}-description`} className="mt-2 break-words text-body text-secondary-foreground">{request.description}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button ref={cancel} variant="secondary" onClick={() => onAnswer(false)}>Cancel</Button><Button variant={request.tone === 'primary' ? 'primary' : 'danger'} onClick={() => onAnswer(true)}>{request.confirmLabel}</Button></div>
    </div>
  </dialog>, document.body);
}
