'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';
import { CardDetail } from './card-detail';

type DrawerProps = { cardId: string; boardHref: string };
const DrawerContext = createContext<((card: DrawerProps) => () => void) | null>(null);

/** Keep the inspector present through route-driven exits, including browser Back. */
export function CardDrawerHost({ children }: { children: ReactNode }) {
  const [inspector, setInspector] = useState<(DrawerProps & { open: boolean }) | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const register = useCallback((card: DrawerProps) => {
    setInspector({ ...card, open: true });
    return () => setInspector((current) => current?.cardId === card.cardId ? { ...current, open: false } : current);
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
function Drawer({ cardId, boardHref, open }: DrawerProps & { open: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const panel = useRef<HTMLDivElement>(null);
  const qs = params.toString();
  const boardUrl = `${boardHref}${qs ? `?${qs}` : ''}`;
  // An explicit board destination is safe even when history started outside the app.
  const close = () => router.push(boardUrl, { scroll: false });

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
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Icon name="description" className="size-4 text-muted-foreground" />
        <h2 id="card-drawer-heading" className="flex-1 text-label font-semibold">Card details</h2>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Focus board" title="Focus board" onClick={() => document.getElementById('board-view')?.focus()}>
          <Icon name="board" />
        </Button>
        {/* A normal anchor intentionally bypasses interception for the full-page view. */}
        <a href={`${boardHref}/c/${cardId}${qs ? `?${qs}` : ''}`} aria-label="Open card as full page" title="Open card as full page" className="ui-button tap size-9 px-0 text-secondary-foreground hover:bg-subtle">
          <Icon name="arrow" />
        </a>
        <Button variant="ghost" size="icon" aria-label="Close card" title="Close card (Escape)" onClick={close}>
          <Icon name="close" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6" data-testid="card-drawer-content">
        <CardDetail key={cardId} cardId={cardId} boardHref={boardHref} layout="drawer" />
      </div>
    </div>
  );
}

export function CardDrawer({ cardId, boardHref }: DrawerProps) {
  const register = useContext(DrawerContext);
  if (!register) throw new Error('CardDrawer requires CardDrawerHost');
  useLayoutEffect(() => register({ cardId, boardHref }), [register, cardId, boardHref]);
  return null;
}
