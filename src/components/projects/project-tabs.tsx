'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { api } from '@/lib/api';
import type { Channel } from '@/lib/types';
import { channelsKey } from '@/lib/unread';
import { useWorkspace } from '@/lib/workspace';

/**
 * A project's own destinations, in its header: the board, the Shared channel guests see and the
 * internal Team channel. Reads the workspace's channel list from the cache the shell keeps live, so
 * unread dots match the sidebar without a second subscription.
 */
export function ProjectTabs({ project }: { project: { id: string; defaultBoardId: string } }) {
  const ws = useWorkspace();
  const pathname = usePathname();
  const channels = useQuery({ queryKey: channelsKey(ws.id), queryFn: () => api.get<{ data: Channel[] }>(`/workspaces/${ws.id}/channels`) });
  const base = `/w/${ws.id}/p/${project.id}`;
  const tabs: { label: string; href: string; icon: IconName; selected: boolean; kind?: 'shared' | 'internal' }[] = [
    { label: 'Board', href: `${base}/b/${project.defaultBoardId}`, icon: 'board', selected: pathname.startsWith(`${base}/b/`) },
    { label: 'Shared', href: `${base}/chat`, icon: 'comment', selected: pathname.startsWith(`${base}/chat`), kind: 'shared' },
    { label: 'Team', href: `${base}/team`, icon: 'lock', selected: pathname.startsWith(`${base}/team`), kind: 'internal' },
  ];
  return (
    <nav aria-label="Project sections" className="flex shrink-0 items-center gap-0.5" data-testid="project-tabs">
      {tabs.map((tab) => {
        const unread = tab.kind && !tab.selected && (channels.data?.data ?? []).some((c) => c.projectId === project.id && c.kind === tab.kind && c.unreadCount > 0);
        return (
          <Link key={tab.label} href={tab.href} aria-current={tab.selected ? 'page' : undefined} data-tour={tab.kind === 'shared' ? 'shared-channel' : undefined}
            className={`ui-button tap relative min-h-8 gap-1.5 px-2.5 text-label ${tab.selected ? 'bg-subtle font-medium text-foreground' : 'text-muted-foreground hover:bg-hover hover:text-foreground'}`}>
            <Icon name={tab.icon} className="size-3.5" />
            <span className={tab.kind ? 'max-sm:sr-only' : ''}>{tab.label}</span>
            {tab.kind === 'internal' ? <span data-testid="internal-badge" className="sr-only">Internal</span> : null}
            {unread ? <span role="img" aria-label={`Unread in ${tab.label}`} data-testid="unread-dot" className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
