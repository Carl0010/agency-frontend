'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';
import { CardDetail } from './card-detail';

type DrawerProps = { cardId: string; projectId: string; boardHref: string };
const DrawerContext = createContext<((card: DrawerProps) => () => void) | null>(null);

/** Keep the inspector present through route-driven exits, including browser Back. */
export function CardDrawerHost({ children }: { children: ReactNode }) {
  const [inspector, setInspector] = useState<(DrawerProps & { open: boolean }) | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const register = useCallback((card: DrawerProps) => {
    setInspector({ ...card, open: true });
    return () => setInspector((current) => current?.cardId === card.cardId && current.projectId === card.projectId ? { ...current, open: false } : current);
  }, []);

  useEffect(() => {
    if (!inspector || inspector.open) return;
    let cancelled = false;
    // Resolve actual CSS transitions rather than maintaining a second duration in JS.
    // No animation support/reduced motion also completes without a delayed timeout.
    const animations = [
      ...frame.current?.getAnimations() ?? [],
      ...frame.current?.querySelector('#card-drawer')?.getAnimations() ?? [],
    ];
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!cancelled) setInspector((current) => current?.open ? current : null);
    });
    return () => { cancelled = true; };
  }, [inspector]);

  return <DrawerContext.Provider value={register}>
    <div className="board-split-view relative flex h-full min-h-0 min-w-0 overflow-hidden">
      {children}
      {inspector ? <div ref={frame} data-testid="card-drawer-frame" data-open={inspector.open} aria-hidden={!inspector.open} inert={!inspector.open} className="card-drawer-frame">
        <Suspense><Drawer {...inspector} /></Suspense>
      </div> : null}
    </div>
  </DrawerContext.Provider>;
}

/** Non-modal card inspector: board and drawer remain independently usable. */
function Drawer({ cardId, projectId, boardHref, open }: DrawerProps & { open: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const panel = useRef<HTMLDivElement>(null);
  const boardParams = new URLSearchParams(params.toString());
  boardParams.delete('full');
  const qs = boardParams.toString();
  const expandedParams = new URLSearchParams(boardParams);
  expandedParams.set('full', 'true');
  const boardUrl = `${boardHref}${qs ? `?${qs}` : ''}`;
  // An explicit board destination is safe even when history started outside the app.
  const close = () => router.push(boardUrl, { scroll: false });

  // Phones: drag the sheet down by its top to close it (a short drag springs back).
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  function dragStart(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' || window.matchMedia('(min-width: 768px)').matches) return;
    if ((event.target as HTMLElement).closest('button, a')) return;
    drag.current = { startY: event.clientY, dy: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.current?.setAttribute('data-dragging', '');
  }
  function dragMove(event: PointerEvent<HTMLElement>) {
    if (!drag.current || !panel.current) return;
    drag.current.dy = Math.max(0, event.clientY - drag.current.startY);
    panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  }
  function dragEnd() {
    if (!drag.current || !panel.current) return;
    const far = drag.current.dy > Math.min(120, panel.current.offsetHeight / 4);
    drag.current = null;
    panel.current.removeAttribute('data-dragging');
    panel.current.style.transform = '';
    if (far) close();
  }

  useEffect(() => {
    if (!open) return;
    const element = panel.current;
    element?.querySelector('[data-testid="card-drawer-content"]')?.scrollTo({ top: 0 });
    element?.focus({ preventScroll: true });
    return () => {
      // Do not steal focus when a user navigates through the still-active board.
      if (element?.contains(document.activeElement) || document.activeElement === document.body) {
        const tile = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(cardId)}"]`);
        (tile ?? document.getElementById('board-view'))?.focus({ preventScroll: true });
      }
    };
  }, [cardId, open]);

  return (
    <>
    {/* Phones: the dimmed strip above the sheet closes it. */}
    <button type="button" tabIndex={-1} aria-hidden="true" onClick={close} className="absolute inset-0 cursor-default md:hidden" />
    <div
      ref={panel}
      id="card-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="card-drawer-heading"
      tabIndex={-1}
      data-testid="card-drawer"
      onKeyDown={(event) => {
        // Inline editors/popovers consume their own Escape before it gets here.
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          close();
        }
      }}
      className="card-drawer-panel flex h-full min-h-0 w-full flex-col border-l border-border bg-surface outline-none"
    >
      <header
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
        className="relative flex shrink-0 touch-none items-center gap-2 border-b border-border px-4 py-3 max-md:pt-5 md:touch-auto"
      >
        <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-border md:hidden" />
        <Icon name="description" className="size-4 text-muted-foreground" />
        <h2 id="card-drawer-heading" className="flex-1 text-label font-semibold">Card details</h2>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Focus board" title="Focus board" onClick={() => document.getElementById('board-view')?.focus()}>
          <Icon name="board" />
        </Button>
        {/* The URL records presentation, including after reload or sharing. */}
        <a href={`${boardHref}/c/${cardId}?${expandedParams}`} aria-label="Open card as full page" title="Open card as full page" className="ui-button tap size-9 px-0 text-secondary-foreground hover:bg-hover">
          <Icon name="expand" />
        </a>
        <Button variant="ghost" size="icon" aria-label="Close card" title="Close card (Escape)" onClick={close}>
          <Icon name="close" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6" data-testid="card-drawer-content">
        <CardDetail key={`${projectId}:${cardId}`} cardId={cardId} projectId={projectId} boardHref={boardHref} layout="drawer" />
      </div>
    </div>
    </>
  );
}

export function CardDrawer({ cardId, projectId, boardHref }: DrawerProps) {
  const register = useContext(DrawerContext);
  if (!register) throw new Error('CardDrawer requires CardDrawerHost');
  useLayoutEffect(() => register({ cardId, projectId, boardHref }), [register, cardId, projectId, boardHref]);
  return null;
}
