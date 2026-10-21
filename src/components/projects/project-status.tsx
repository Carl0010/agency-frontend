'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { useWriteAvailability } from '@/components/billing/billing-notices';
import { api, errorMessage } from '@/lib/api';
import { PROJECT_STATUSES, projectStatus, statusSince, type StatusTone } from '@/lib/project-status';
import type { Project, ProjectStatus } from '@/lib/types';
import { useWorkspace } from '@/lib/workspace';

// Members only: guest surfaces never import this file.

const TONES: Record<StatusTone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-subtle text-secondary-foreground', dot: 'bg-muted-foreground' },
  info: { pill: 'bg-info-subtle text-info-text', dot: 'bg-info' },
  warning: { pill: 'bg-warning-subtle text-warning-text', dot: 'bg-warning' },
  success: { pill: 'bg-success-subtle text-success-text', dot: 'bg-success' },
  muted: { pill: 'border border-border bg-surface text-muted-foreground', dot: 'bg-disabled-foreground' },
};

function PillBody({ status }: { status: string | undefined }) {
  const shown = projectStatus(status);
  return <><span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${TONES[shown.tone].dot}`} />{shown.label}</>;
}

const PILL = 'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium whitespace-nowrap';

/** Read-only status: a dot and the label, never colour alone. */
export function ProjectStatusPill({ project, className = '' }: { project: Pick<Project, 'status' | 'statusChangedAt'>; className?: string }) {
  const since = statusSince(project.statusChangedAt);
  return <span data-testid="project-status" data-status={projectStatus(project.status).value} title={since ?? undefined} className={`${PILL} ${TONES[projectStatus(project.status).tone].pill} ${className}`}><PillBody status={project.status} /></span>;
}

/** Header pill that opens a radio menu of the five statuses; read-only when the workspace is. */
export function ProjectStatusMenu({ project }: { project: Project }) {
  const ws = useWorkspace();
  const { readOnly } = useWriteAvailability(ws);
  const qc = useQueryClient();
  const toast = useToast();
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const current = projectStatus(project.status).value;
  const save = useMutation({
    mutationFn: (status: ProjectStatus) => api.patch<Project>(`/projects/${project.id}`, { status }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['project', project.id] });
      const previous = qc.getQueryData<Project>(['project', project.id]);
      qc.setQueryData<Project>(['project', project.id], (item) => item ? { ...item, status } : item);
      return { previous };
    },
    onError: (error, _status, context) => {
      if (context?.previous) qc.setQueryData(['project', project.id], context.previous);
      toast(errorMessage(error));
      // A 402 means the workspace lapsed since it was loaded: refresh the billing banners.
      void qc.invalidateQueries({ queryKey: ['billing', ws.id] });
      void qc.invalidateQueries({ queryKey: ['workspace', ws.id] });
    },
    onSuccess: (saved) => { qc.setQueryData(['project', saved.id], saved); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['projects', ws.id] }); },
  });
  const since = statusSince(project.statusChangedAt);
  if (readOnly) return <ProjectStatusPill project={project} />;

  const items = () => [...(popover.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
  function choose(status: ProjectStatus) {
    popover.current?.hidePopover();
    if (status !== current) save.mutate(status);
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const all = items(); const index = all.indexOf(document.activeElement as HTMLButtonElement);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    all[(next + all.length) % all.length]?.focus();
  }
  const tone = TONES[projectStatus(project.status).tone];
  return <>
    <button type="button" popoverTarget={id} aria-haspopup="menu" aria-busy={save.isPending || undefined} aria-disabled={save.isPending || undefined}
      aria-label={`Project status: ${projectStatus(project.status).label}${save.isPending ? ', saving' : ''}. Change status`}
      title={since ?? undefined} data-testid="project-status" data-status={current}
      className={`${PILL} tap hover:brightness-95 aria-disabled:opacity-70 ${tone.pill}`}
      onClick={(event) => {
        // Keep focus on the pill while saving; just do not open the menu again.
        if (save.isPending) { event.preventDefault(); popover.current?.hidePopover(); return; }
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 216)), top: Math.min(rect.bottom + 4, window.innerHeight - 240) });
      }}>
      <PillBody status={project.status} />{save.isPending ? <span className="sr-only">Saving…</span> : <Icon name="chevron" className="size-3 rotate-90" />}
    </button>
    <div ref={popover} id={id} popover="auto" role="menu" aria-label="Project status" style={position} onKeyDown={onKeyDown}
      onToggle={(event) => { if (event.newState === 'open') (items().find((item) => item.getAttribute('aria-checked') === 'true') ?? items()[0])?.focus(); }}
      className="fixed m-0 w-52 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg">
      {PROJECT_STATUSES.map((status) => <button key={status.value} type="button" role="menuitemradio" aria-checked={status.value === current} tabIndex={-1}
        className="ui-nav-link tap w-full" onClick={() => choose(status.value)}>
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${TONES[status.tone].dot}`} /><span className="flex-1 text-left">{status.label}</span>
        {status.value === current ? <Icon name="check" className="size-3.5" /> : null}
      </button>)}
    </div>
  </>;
}
