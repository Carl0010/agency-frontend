'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { GuestsButton } from '@/components/guests/guest-panel';
import { api } from '@/lib/api';
import type { ChannelKind, Page, Project } from '@/lib/types';
import { useWorkspaceChannels } from '@/lib/unread';
import { useWorkspace } from '@/lib/workspace';

export function UnreadDot({ label }: { label: string }) {
  return <span role="img" aria-label={label} data-testid="unread-dot" className="inline-block size-2 shrink-0 rounded-full bg-blue-600" />;
}

/** Left rail: every project, each with an unread dot for its channels (§3.2). */
export function ProjectRail({ open, onClose, currentProjectId }: { open: boolean; onClose: () => void; currentProjectId: string }) {
  const ws = useWorkspace();
  const unread = useWorkspaceChannels();
  const projects = useQuery({ queryKey: ['projects', ws.id], queryFn: () => api.get<Page<Project>>(`/workspaces/${ws.id}/projects`) });
  const body = (
    <nav aria-label="Projects" className="space-y-1 p-2">
      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Clients</p>
      {(projects.data?.data ?? []).map((p) => (
        <Link
          key={p.id}
          href={`/w/${ws.slug}/p/${p.id}/b/${p.defaultBoardId}`}
          onClick={onClose}
          aria-current={p.id === currentProjectId ? 'page' : undefined}
          data-testid="rail-project"
          className={`tap flex items-center gap-2 rounded px-2 py-1.5 text-sm ${p.id === currentProjectId ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}
        >
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
          {unread.projectUnread(p.id) ? <UnreadDot label={`Unread messages in ${p.name}`} /> : null}
        </Link>
      ))}
    </nav>
  );
  return (
    <>
      <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">{body}</aside>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Projects">
          <button type="button" aria-label="Close projects" className="absolute inset-0 bg-black/30" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-xl">{body}</aside>
        </div>
      ) : null}
    </>
  );
}

/** `Board | Chat | Team` (§3.2), with unread dots on the two channel tabs. */
export function ProjectTabs({
  projectId,
  boardId,
  current,
}: {
  projectId: string;
  boardId: string | null;
  current: 'board' | ChannelKind;
}) {
  const ws = useWorkspace();
  const unread = useWorkspaceChannels();
  const channels = unread.forProject(projectId);
  const base = `/w/${ws.slug}/p/${projectId}`;
  const tabs: { key: 'board' | ChannelKind; label: string; href: string }[] = [
    { key: 'board', label: 'Board', href: boardId ? `${base}/b/${boardId}` : base },
    { key: 'client', label: 'Chat', href: `${base}/chat` },
    { key: 'internal', label: 'Team', href: `${base}/team` },
  ];
  return (
    <nav className="flex gap-1 text-sm" aria-label="Project sections">
      {tabs.map((t) => {
        const dot = t.key !== 'board' && t.key !== current && channels.some((c) => c.kind === t.key && c.unreadCount > 0);
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === current ? 'page' : undefined}
            data-tour={t.key === 'client' ? 'client-channel' : undefined}
            className={`tap flex items-center gap-1.5 rounded px-2 ${t.key === current ? 'bg-slate-100 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {t.label}
            {t.key === 'internal' ? (
              <span data-testid="internal-badge" className="rounded bg-slate-200 px-1 text-[10px] font-medium text-slate-700">
                Internal
              </span>
            ) : null}
            {dot ? <UnreadDot label={`Unread in ${t.label}`} /> : null}
          </Link>
        );
      })}
      <GuestsButton projectId={projectId} />
    </nav>
  );
}
