'use client';

import Link from 'next/link';
import { Icon } from '@/components/icon';
import { NotificationBell } from '@/components/notifications';
import { useWorkspace } from '@/lib/workspace';
import type { WorkspaceModule } from './workspace-modules';

/** The 72px rail switches modules; the neighboring sidebar owns their details. */
export function ModuleRail({ activeModule, onNavigate }: { activeModule: WorkspaceModule; onNavigate?: () => void }) {
  const ws = useWorkspace();
  const base = `/w/${ws.slug}`;
  return (
    <div className="flex h-full flex-col" data-testid="module-rail">
      <nav aria-label="Main modules" className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-1 py-4">
        <Link href={`${base}/projects`} onClick={onNavigate} title="Projects" aria-current={activeModule === 'projects' ? 'location' : undefined} className="ui-module-link tap">
          <Icon name="projects" className="size-5" /><span>Projects</span>
        </Link>
        <NotificationBell active={activeModule === 'inbox'} onNavigate={onNavigate} />
        <Link href={`${base}/settings/members`} onClick={onNavigate} title="Workspace" aria-current={activeModule === 'workspace' ? 'location' : undefined} className="ui-module-link tap">
          <Icon name="settings" className="size-5" /><span>Workspace</span>
        </Link>
      </nav>
    </div>
  );
}
