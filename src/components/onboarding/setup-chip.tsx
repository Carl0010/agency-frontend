'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { api, errorMessage } from '@/lib/api';
import type { Workspace } from '@/lib/types';

/** "Finish setup (n/4)" — the stepper's way back in, until the owner dismisses it (§3.5, AC20). */
export function SetupChip({ ws, onNavigate }: { ws: Workspace; onNavigate?: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  if (ws.role !== 'owner' || !ws.setup?.showChip) return null;
  const dismiss = async () => {
    try {
      await api.patch(`/workspaces/${ws.id}/onboarding`, { dismissed: true });
      await qc.invalidateQueries({ queryKey: ['workspace', ws.slug] });
      await qc.invalidateQueries({ queryKey: ['workspaces'] });
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  return (
    <span data-testid="setup-chip" className="flex items-center justify-between rounded-md bg-primary-subtle text-caption font-medium text-primary-text">
      <Link href="/onboarding" onClick={onNavigate} className="tap flex flex-1 items-center px-2.5">
        Finish setup ({ws.setup.done}/{ws.setup.total})
      </Link>
      <button type="button" aria-label="Dismiss setup" className="tap px-1.5 text-primary hover:text-primary-text" onClick={() => void dismiss()}>
        ×
      </button>
    </span>
  );
}
