'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Workspace } from '@/lib/types';

/** "Finish setup (n/4)" — the stepper's way back in, until the owner dismisses it (§3.5, AC20). */
export function SetupChip({ ws }: { ws: Workspace }) {
  const qc = useQueryClient();
  if (ws.role !== 'owner' || !ws.setup?.showChip) return null;
  const dismiss = async () => {
    await api.patch(`/workspaces/${ws.id}/onboarding`, { dismissed: true });
    await qc.invalidateQueries({ queryKey: ['workspace', ws.slug] });
    await qc.invalidateQueries({ queryKey: ['workspaces'] });
  };
  return (
    <span data-testid="setup-chip" className="hidden items-center rounded-full bg-blue-50 text-xs font-medium text-blue-800 sm:inline-flex">
      <Link href="/onboarding" className="tap flex items-center px-2.5">
        Finish setup ({ws.setup.done}/{ws.setup.total})
      </Link>
      <button type="button" aria-label="Dismiss setup" className="tap px-1.5 text-blue-600 hover:text-blue-900" onClick={() => void dismiss()}>
        ×
      </button>
    </span>
  );
}
