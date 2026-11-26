'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/icon';
import { AppLoader } from '@/components/skeleton';
import { Button } from '@/components/ui';
import { loadPaddle, PADDLE_CLIENT_TOKEN, PADDLE_ENVIRONMENT, safeReturnPath, withCheckoutResult } from '@/lib/paddle';

/**
 * Paddle's "default payment link" (§8.1). The API's checkout URL lands here as
 * `/pay?_ptxn=<transaction>&next=<billing path>`, and Paddle's own emails (update a payment
 * method, a failed renewal) link here with `_ptxn` too. Paddle.js reads `_ptxn` and opens its
 * checkout overlay; afterwards the owner goes back to `next`. Public on purpose: the transaction
 * id is unguessable, and Paddle asks the payer for everything else.
 */
export default function PayPage() {
  return (
    <Suspense fallback={<AppLoader label="Opening checkout" />}>
      <Checkout />
    </Suspense>
  );
}

type State = { kind: 'opening' } | { kind: 'open' } | { kind: 'problem'; title: string; detail: string; retry?: boolean };

function Checkout() {
  const params = useSearchParams();
  const router = useRouter();
  const transaction = params.get('_ptxn');
  const back = safeReturnPath(params.get('next'));
  const completed = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>(() =>
    !transaction
      ? { kind: 'problem', title: 'This checkout link is incomplete', detail: 'Start again from Billing in your workspace settings.' }
      : !PADDLE_CLIENT_TOKEN
        ? { kind: 'problem', title: 'Checkout isn’t set up yet', detail: 'Payments aren’t configured on this site. Nothing was charged.' }
        : { kind: 'opening' },
  );

  useEffect(() => {
    if (!transaction || !PADDLE_CLIENT_TOKEN) return;
    let cancelled = false;
    loadPaddle()
      .then((paddle) => {
        if (cancelled) return;
        if (PADDLE_ENVIRONMENT === 'sandbox') paddle.Environment.set('sandbox');
        // Paddle.js opens the checkout for `_ptxn` in this page's URL as soon as it initializes.
        paddle.Initialize({
          token: PADDLE_CLIENT_TOKEN,
          checkout: {
            settings: {
              displayMode: 'overlay',
              theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
              successUrl: new URL(withCheckoutResult(back, 'success'), window.location.origin).toString(),
              allowLogout: false,
            },
          },
          eventCallback: (event) => {
            if (event.name === 'checkout.loaded') setState({ kind: 'open' });
            if (event.name === 'checkout.completed') completed.current = true;
            if (event.name === 'checkout.closed') router.replace(withCheckoutResult(back, completed.current ? 'success' : 'canceled'));
          },
        });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'problem', title: 'Checkout couldn’t load', detail: 'Check your connection, or turn off a blocker for this page, then try again. Nothing was charged.', retry: true });
      });
    return () => {
      cancelled = true;
    };
  }, [transaction, back, router, attempt]);

  if (state.kind !== 'problem') return <AppLoader label={state.kind === 'open' ? 'Checkout is open' : 'Opening checkout'} />;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="ui-panel w-full max-w-sm p-6 text-center">
        <BrandMark className="mx-auto mb-4 size-12 rounded-xl" glyphClassName="size-7" />
        <h1 className="text-page font-semibold">{state.title}</h1>
        <p role="alert" className="mt-2 text-label text-secondary-foreground">{state.detail}</p>
        <div className="mt-5 flex flex-col gap-2">
          {state.retry ? <Button onClick={() => { setState({ kind: 'opening' }); setAttempt((n) => n + 1); }}>Try again</Button> : null}
          <Link href={back} className="tap text-label text-primary">{back === '/' ? 'Go to Agency' : 'Back to billing'}</Link>
        </div>
        <p className="mt-5 text-caption text-muted-foreground">Payments are processed by Paddle, our reseller and merchant of record.</p>
      </div>
    </main>
  );
}
