'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { FormError } from '@/components/auth-card';
import { ExportButtons, useBilling } from '@/components/billing/billing-notices';
import { useConfirm } from '@/components/confirmation';
import { useToast } from '@/components/toast';
import { Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Billing, SubscriptionStatus } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

/**
 * Billing (§8.6), owner only. Card entry, invoices' payment and cancellation
 * happen on Stripe's hosted Checkout and Billing Portal — there is no card
 * form in this app (AC2). Everything shown is read from the billing endpoint.
 */

const STATUS: Record<SubscriptionStatus, { label: string; tone: string }> = {
  trialing: { label: 'Trial', tone: 'bg-primary-muted text-primary-text' },
  active: { label: 'Active', tone: 'bg-success-muted text-success-text' },
  past_due: { label: 'Past due', tone: 'bg-warning-muted text-warning-text' },
  unpaid: { label: 'Read-only', tone: 'bg-danger-muted text-danger-text' },
  canceled: { label: 'Canceled', tone: 'bg-danger-muted text-danger-text' },
  incomplete: { label: 'Incomplete', tone: 'bg-muted text-secondary-foreground' },
};

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

export default function BillingPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <BillingScreen />
    </Suspense>
  );
}

function BillingScreen() {
  const ws = useWorkspace();
  const confirmAction = useConfirm();
  const billing = useBilling(ws);
  const qc = useQueryClient();
  const toast = useToast();
  const params = useSearchParams();
  const checkoutResult = params.get('checkout');

  useEffect(() => {
    if (checkoutResult === 'success') {
      toast('Payment method added. Stripe can take a few seconds to confirm.', 'info');
      void qc.invalidateQueries({ queryKey: ['billing', ws.id] });
    }
  }, [checkoutResult, toast, qc, ws.id]);

  const go = useMutation({
    mutationFn: (kind: 'checkout-session' | 'portal-session') => api.post<{ url: string }>(`/workspaces/${ws.id}/billing/${kind}`),
    onSuccess: ({ url }) => window.location.assign(url),
  });

  if (ws.role !== 'owner') {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <h1 className="mb-4 text-2xl font-semibold">Billing</h1>
        <p data-testid="billing-owner-only" className="rounded-lg border border-border bg-surface p-4 text-secondary-foreground">
          Only the workspace owner can manage billing.
        </p>
      </main>
    );
  }
  if (billing.isPending) return <Spinner />;
  if (!billing.data) return <FormError message={errorMessage(billing.error)} />;
  const b: Billing = billing.data;
  const status = STATUS[b.status];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <FormError message={go.error ? errorMessage(go.error) : null} />

      <section className="rounded-lg border border-border bg-surface p-4" aria-label="Plan">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{b.plan.name}</h2>
          <span data-testid="billing-status" className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>
            {status.label}
          </span>
          <span className="ml-auto text-lg font-semibold">
            {money(b.plan.amountCents, b.plan.currency)}
            <span className="text-sm font-normal text-muted-foreground"> / {b.plan.interval}</span>
          </span>
        </div>
        <p className="mt-1 text-sm text-secondary-foreground">
          Up to {b.plan.seatsIncluded} seats (owner, admins, members) · unlimited client guests · unlimited projects.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Seats</dt>
            <dd data-testid="billing-seats" className={b.seats.full ? 'font-medium text-warning-text' : ''}>
              {b.seats.used} of {b.seats.included} seats used
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{b.notice.trialPill ? 'Trial' : 'Next charge'}</dt>
            <dd data-testid="billing-next">
              {b.notice.trialPill
                ? `${b.notice.trialPill.daysLeft} days left${b.trialEndsAt ? ` · ends ${day(b.trialEndsAt)}` : ''}`
                : b.nextCharge
                  ? `${money(b.nextCharge.amountCents, b.nextCharge.currency)} on ${day(b.nextCharge.at)}`
                  : b.cancelAtPeriodEnd && b.currentPeriodEnd
                    ? `Cancels on ${day(b.currentPeriodEnd)}`
                    : '—'}
            </dd>
          </div>
        </dl>
        {b.notice.trialPill && b.nextCharge ? (
          <p className="mt-2 text-sm text-secondary-foreground">Billing is set up. The first charge lands when the trial ends.</p>
        ) : null}
        {b.dataDeleteAfter ? (
          <p className="mt-2 text-sm text-danger-text">Canceled. Data is kept until {day(b.dataDeleteAfter)} — reactivate any time before then.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {b.hasPaymentMethod ? (
            <Button disabled={!b.configured || go.isPending} onClick={() => go.mutate('portal-session')}>
              Manage billing
            </Button>
          ) : (
            <Button disabled={!b.configured || go.isPending} onClick={() => go.mutate('checkout-session')}>
              {b.notice.readOnly ? 'Reactivate' : 'Add payment method'}
            </Button>
          )}
          {b.hasPaymentMethod && !b.cancelAtPeriodEnd ? (
            <Button
              variant="secondary"
              disabled={!b.configured || go.isPending}
              onClick={async () => {
                if (await confirmAction({ title: 'Continue to subscription cancellation?', description: 'After cancellation, everyone keeps read-only access and can export their work. You will confirm the cancellation on Stripe.', confirmLabel: 'Continue to Stripe' })) {
                  go.mutate('portal-session');
                }
              }}
            >
              Cancel subscription
            </Button>
          ) : null}
        </div>
        {!b.configured ? <p className="mt-2 text-xs text-muted-foreground">Billing is not configured on this server.</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">Card details are entered on Stripe and never touch our servers.</p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4" aria-label="Invoices">
        <h2 className="mb-2 font-semibold">Invoices</h2>
        {b.invoices.length === 0 ? (
          <p className="text-sm text-secondary-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-border-subtle text-sm">
            {b.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-28 text-secondary-foreground">{day(i.createdAt)}</span>
                <span className="flex-1">{i.number ?? i.id}</span>
                <span>{money(i.amountCents, i.currency)}</span>
                <span className="w-16 capitalize text-secondary-foreground">{i.status ?? ''}</span>
                {i.hostedUrl ? (
                  <a className="text-primary hover:underline" href={i.hostedUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-4" aria-label="Export">
        <h2 className="mb-1 font-semibold">Export your data</h2>
        <p className="mb-3 text-sm text-secondary-foreground">Every project, card, comment and message — on any plan state, including read-only.</p>
        <ExportButtons ws={ws} />
      </section>
    </main>
  );
}
