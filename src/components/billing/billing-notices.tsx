'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { api, download, errorMessage } from '@/lib/api';
import type { Billing, BillingBanner, Workspace } from '@/lib/types';

/**
 * Billing state in the workspace chrome (§8.2–§8.4). Every number, date and
 * flag shown here comes from `GET /workspaces/:id/billing` — this file does
 * no date or seat arithmetic (AC18). Only the owner can read billing; other
 * members learn just that the workspace is read-only, from its status.
 */

const READ_ONLY = new Set(['unpaid', 'canceled', 'incomplete']);

export function useBilling(ws: Workspace) {
  return useQuery({
    queryKey: ['billing', ws.id],
    queryFn: () => api.get<Billing>(`/workspaces/${ws.id}/billing`),
    enabled: ws.role === 'owner',
    staleTime: 60_000,
  });
}

/** Owner flags are server-computed; other members use the published status gates. */
export function useWriteAvailability(ws: Workspace) {
  const billing = useBilling(ws);
  const status = ws.subscription?.status;
  return {
    readOnly: billing.data?.notice.readOnly ?? (status ? READ_ONLY.has(status) : false),
    invitesBlocked: billing.data?.notice.invitesBlocked ?? (status ? status !== 'trialing' && status !== 'active' : false),
  };
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** "14 days left in trial · Add billing" — amber at ≤ 3 days (§8.2). */
export function TrialPill({ ws, onNavigate }: { ws: Workspace; onNavigate?: () => void }) {
  const billing = useBilling(ws);
  const pill = billing.data?.notice.trialPill;
  if (!pill) return null;
  const text = `${pill.daysLeft} ${pill.daysLeft === 1 ? 'day' : 'days'} left in trial`;
  return (
    <Link
      href={`/w/${ws.slug}/settings/billing`}
      onClick={onNavigate}
      data-testid="trial-pill"
      data-amber={pill.amber ? 'true' : 'false'}
      className={`tap flex items-center rounded-md px-2.5 text-caption font-medium ${pill.amber ? 'bg-warning-muted text-warning-text' : 'bg-subtle text-secondary-foreground'}`}
    >
      {text}
      {billing.data?.hasPaymentMethod ? '' : ' · Add billing'}
    </Link>
  );
}

export function ExportButtons({ ws, variant = 'secondary' }: { ws: Workspace; variant?: 'secondary' | 'ghost' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const get = async (format: 'json' | 'csv') => {
    setBusy(true);
    try {
      await download(`/workspaces/${ws.id}/export${format === 'csv' ? '?format=csv' : ''}`, `${ws.slug}-export.${format}`);
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex gap-2">
      <Button variant={variant} disabled={busy} onClick={() => void get('json')}>
        Export JSON
      </Button>
      <Button variant={variant} disabled={busy} onClick={() => void get('csv')}>
        Export CSV
      </Button>
    </span>
  );
}

function Banner({ tone, children, testId }: { tone: 'info' | 'warn' | 'danger'; children: ReactNode; testId: string }) {
  const tones = {
    info: 'border-info-border bg-info-subtle text-info-text',
    warn: 'border-warning-border bg-warning-subtle text-warning-text',
    danger: 'border-danger-border bg-danger-subtle text-danger-text',
  }[tone];
  return (
    <div role="status" data-testid={testId} className={`flex flex-wrap items-center gap-3 border-b px-4 py-2 text-sm ${tones}`}>
      {children}
    </div>
  );
}

function dismissKey(ws: Workspace, b: BillingBanner): string {
  return `agency:banner:${ws.id}:${b.kind}:${b.kind === 'trial' ? b.day : ''}`;
}

function OwnerBanner({ ws, billing }: { ws: Workspace; billing: Billing }) {
  const b = billing.notice.banner;
  const [dismissed, setDismissed] = useState<string | null>(() => {
    if (!b || b.kind !== 'trial') return null;
    try {
      return localStorage.getItem(dismissKey(ws, b));
    } catch {
      return null;
    }
  });
  const billingHref = `/w/${ws.slug}/settings/billing`;
  if (!b) return null;
  switch (b.kind) {
    case 'trial':
      if (dismissed) return null;
      return (
        <Banner tone="warn" testId="trial-banner">
          <span className="flex-1">
            Your trial ends in {b.daysLeft} {b.daysLeft === 1 ? 'day' : 'days'}. Add billing to keep everything running — the first
            charge still lands when the trial ends.
          </span>
          <Link className="font-medium underline" href={billingHref}>
            Add billing
          </Link>
          <button
            type="button"
            aria-label="Dismiss"
            className="px-1"
            onClick={() => {
              try {
                localStorage.setItem(dismissKey(ws, b), '1');
              } catch {
                // Storage disabled: dismiss for this page view only.
              }
              setDismissed('1');
            }}
          >
            ×
          </button>
        </Banner>
      );
    case 'grace':
      return (
        <Banner tone="warn" testId="grace-banner">
          <span className="flex-1">
            Your trial has ended. Everything keeps working until {fmtDate(b.graceEndsAt)}; after that the workspace becomes read-only.
          </span>
          <Link className="font-medium underline" href={billingHref}>
            Add billing
          </Link>
        </Banner>
      );
    case 'past_due':
      return (
        <Banner tone="warn" testId="past-due-banner">
          <span className="flex-1">The last payment failed. Update the card to keep the workspace running; new invites are paused meanwhile.</span>
          <Link className="font-medium underline" href={billingHref}>
            Manage billing
          </Link>
        </Banner>
      );
    case 'read_only':
      return (
        <Banner tone="danger" testId="read-only-banner">
          <span className="flex-1">
            {b.reason === 'canceled' ? 'The subscription is canceled' : b.reason === 'trial_expired' ? 'The trial has ended' : 'Payment is overdue'} — this
            workspace is read-only. Everyone can still read and export everything.
            {b.dataDeleteAfter ? ` Data is kept until ${fmtDate(b.dataDeleteAfter)}.` : ''}
          </span>
          <Link className="font-medium underline" href={billingHref}>
            Reactivate
          </Link>
          <ExportButtons ws={ws} variant="ghost" />
        </Banner>
      );
  }
}

/** The banners under the workspace header, highest priority first. */
export function BillingBanners({ ws }: { ws: Workspace }) {
  const billing = useBilling(ws);
  if (ws.role === 'owner') {
    if (!billing.data) return null;
    return (
      <>
        <OwnerBanner ws={ws} billing={billing.data} />
        {billing.data.seats.overCap ? (
          <Banner tone="warn" testId="over-cap-banner">
            <span className="flex-1">
              You have {billing.data.seats.used} members on a {billing.data.seats.included}-seat plan. Deactivate one member to continue inviting.
            </span>
            <Link className="font-medium underline" href={`/w/${ws.slug}/settings/members`}>
              Manage members
            </Link>
          </Banner>
        ) : null}
      </>
    );
  }
  if (ws.subscription && READ_ONLY.has(ws.subscription.status)) {
    return (
      <Banner tone="danger" testId="read-only-banner">
        <span className="flex-1">This workspace is read-only until the owner reactivates it. You can still read and export everything.</span>
        <ExportButtons ws={ws} variant="ghost" />
      </Banner>
    );
  }
  return null;
}
