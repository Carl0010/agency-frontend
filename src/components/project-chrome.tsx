'use client';

import { GuestsButton } from '@/components/guests/guest-panel';

/** Project-level actions (§3.2); navigation is owned by the workspace sidebar. */
export function ProjectActions({ projectId }: { projectId: string }) {
  return <GuestsButton projectId={projectId} />;
}
