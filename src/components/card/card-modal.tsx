'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { CardDetail } from './card-detail';

/**
 * Card detail over the board. Esc or the backdrop closes back to the board;
 * below 640px it is a full-screen sheet (AC23).
 */
function Modal({ cardId, boardHref }: { cardId: string; boardHref: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const panel = useRef<HTMLDivElement>(null);
  const qs = params.toString();
  // Go back to the board URL (keeping filters) rather than history.back(), which may leave the app.
  const close = () => router.push(`${boardHref}${qs ? `?${qs}` : ''}`, { scroll: false });

  useEffect(() => {
    panel.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-overlay/40 sm:items-start sm:overflow-y-auto sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Card"
        tabIndex={-1}
        data-testid="card-modal"
        className="relative h-full w-full overflow-y-auto bg-surface p-4 outline-none sm:h-auto sm:max-w-5xl sm:rounded-xl sm:p-6 sm:shadow-xl"
      >
        <button type="button" aria-label="Close card" onClick={close} className="tap absolute right-2 top-2 z-10 rounded-full px-2 text-xl text-muted-foreground hover:bg-subtle">
          ×
        </button>
        <CardDetail cardId={cardId} boardHref={boardHref} />
      </div>
    </div>
  );
}

export function CardModal(props: { cardId: string; boardHref: string }) {
  return (
    <Suspense>
      <Modal {...props} />
    </Suspense>
  );
}
