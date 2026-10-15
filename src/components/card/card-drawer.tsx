'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { Icon } from '@/components/icon';
import { Button } from '@/components/ui';
import { CardDetail } from './card-detail';

/** Non-modal card inspector: board and drawer remain independently usable. */
function Drawer({ cardId, boardHref }: { cardId: string; boardHref: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const panel = useRef<HTMLDivElement>(null);
  const qs = params.toString();
  const boardUrl = `${boardHref}${qs ? `?${qs}` : ''}`;
  // An explicit board destination is safe even when history started outside the app.
  const close = () => router.push(boardUrl, { scroll: false });

  useEffect(() => {
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
  }, [cardId]);

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
      className="absolute inset-0 z-40 flex h-full min-h-0 w-full flex-col border-l border-border bg-surface outline-none md:relative md:inset-auto md:w-[28rem] md:shrink-0 xl:w-[32rem] 2xl:w-[36rem]"
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

export function CardDrawer(props: { cardId: string; boardHref: string }) {
  return <Suspense><Drawer {...props} /></Suspense>;
}
